from __future__ import annotations

import argparse
import json
from collections import Counter
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import numpy as np
import torch
from sklearn.metrics import f1_score, mean_absolute_error, mean_squared_error
from torch import nn
from torch.utils.data import DataLoader, WeightedRandomSampler
from tqdm import tqdm
from transformers import AutoModel, AutoTokenizer

from dataset import DaicWozMultimodalDataset, load_feature_normalizers, pad_sequence_batch
from models import AudioEncoder, CrossModalTransformerFusion, GatedFusion, VideoEncoder
from phq import severity_index


class ChunkedMultimodalCollator:
    def __init__(self, text_model_name: str, max_text_tokens: int = 192, max_text_chunks: int = 12) -> None:
        self.tokenizer = AutoTokenizer.from_pretrained(text_model_name)
        self.max_text_tokens = max_text_tokens
        self.max_text_chunks = max_text_chunks
        self.words_per_chunk = max(32, int(max_text_tokens * 0.65))

    def encode_chunks(self, text: str) -> dict[str, torch.Tensor]:
        words = text.split()
        chunks = [" ".join(words[index : index + self.words_per_chunk]) for index in range(0, len(words), self.words_per_chunk)]
        chunks = (chunks or [""])[: self.max_text_chunks]
        encoded = self.tokenizer(
            chunks,
            padding="max_length",
            truncation=True,
            max_length=self.max_text_tokens,
            return_tensors="pt",
        )
        input_ids = [row.tolist() for row in encoded["input_ids"]]
        attention_masks = [row.tolist() for row in encoded["attention_mask"]]
        chunk_mask = [True] * len(chunks)

        while len(input_ids) < self.max_text_chunks:
            input_ids.append([self.tokenizer.pad_token_id] * self.max_text_tokens)
            attention_masks.append([0] * self.max_text_tokens)
            chunk_mask.append(False)

        return {
            "input_ids": torch.tensor(input_ids, dtype=torch.long),
            "attention_mask": torch.tensor(attention_masks, dtype=torch.long),
            "chunk_mask": torch.tensor(chunk_mask, dtype=torch.bool),
        }

    def __call__(self, batch: list[dict[str, Any]]) -> dict[str, Any]:
        encoded_texts = [self.encode_chunks(item["text"]) for item in batch]
        audio, audio_mask = pad_sequence_batch([item["audio"] for item in batch])
        video, video_mask = pad_sequence_batch([item["video"] for item in batch])

        return {
            "participant_id": [item["participant_id"] for item in batch],
            "text": {
                "input_ids": torch.stack([item["input_ids"] for item in encoded_texts]),
                "attention_mask": torch.stack([item["attention_mask"] for item in encoded_texts]),
                "chunk_mask": torch.stack([item["chunk_mask"] for item in encoded_texts]),
            },
            "audio": audio,
            "audio_mask": audio_mask,
            "video": video,
            "video_mask": video_mask,
            "phq_score": torch.stack([item["phq_score"] for item in batch]),
            "severity": torch.stack([item["severity"] for item in batch]),
        }


class ChunkedTextEncoder(nn.Module):
    def __init__(
        self,
        model_name: str,
        output_dim: int,
        freeze: bool = True,
        unfreeze_last_n: int = 0,
        dropout: float = 0.2,
    ) -> None:
        super().__init__()
        self.transformer = AutoModel.from_pretrained(model_name)
        self.freeze_transformer = freeze and unfreeze_last_n <= 0
        hidden_size = self.transformer.config.hidden_size
        self.projection = nn.Sequential(nn.Linear(hidden_size, output_dim), nn.LayerNorm(output_dim), nn.GELU(), nn.Dropout(dropout))
        self.chunk_attention = nn.Linear(output_dim, 1)

        if freeze:
            for param in self.transformer.parameters():
                param.requires_grad = False
            self._unfreeze_last_layers(unfreeze_last_n)
            self.freeze_transformer = unfreeze_last_n <= 0

    def _unfreeze_last_layers(self, count: int) -> None:
        if count <= 0:
            return
        layers = None
        if hasattr(self.transformer, "encoder") and hasattr(self.transformer.encoder, "layer"):
            layers = self.transformer.encoder.layer
        elif hasattr(self.transformer, "transformer") and hasattr(self.transformer.transformer, "layer"):
            layers = self.transformer.transformer.layer
        if layers is None:
            return
        for layer in list(layers)[-count:]:
            for param in layer.parameters():
                param.requires_grad = True

    def forward(self, tokenized: dict[str, torch.Tensor]) -> torch.Tensor:
        input_ids = tokenized["input_ids"]
        attention_mask = tokenized["attention_mask"]
        chunk_mask = tokenized["chunk_mask"]
        batch_size, chunk_count, token_count = input_ids.shape

        flat_input_ids = input_ids.reshape(batch_size * chunk_count, token_count)
        flat_attention_mask = attention_mask.reshape(batch_size * chunk_count, token_count)

        if self.freeze_transformer:
            with torch.no_grad():
                outputs = self.transformer(input_ids=flat_input_ids, attention_mask=flat_attention_mask)
        else:
            outputs = self.transformer(input_ids=flat_input_ids, attention_mask=flat_attention_mask)

        pooled = outputs.last_hidden_state[:, 0].reshape(batch_size, chunk_count, -1)
        projected = self.projection(pooled)
        scores = self.chunk_attention(projected).squeeze(-1).masked_fill(~chunk_mask, -1e4)
        weights = torch.softmax(scores, dim=-1)
        return (projected * weights.unsqueeze(-1)).sum(dim=1)


class ChunkedMultimodalPhqModel(nn.Module):
    def __init__(
        self,
        text_model_name: str,
        audio_input_dim: int,
        video_input_dim: int,
        fusion_dim: int = 128,
        fusion_type: str = "gated",
        freeze_text: bool = True,
        unfreeze_last_text_layers: int = 0,
        dropout: float = 0.4,
    ) -> None:
        super().__init__()
        self.text_encoder = ChunkedTextEncoder(text_model_name, fusion_dim, freeze_text, unfreeze_last_text_layers, dropout)
        self.audio_encoder = AudioEncoder(audio_input_dim, fusion_dim)
        self.video_encoder = VideoEncoder(video_input_dim, fusion_dim)

        if fusion_type == "gated":
            self.fusion = GatedFusion(fusion_dim)
        elif fusion_type == "cross_modal":
            self.fusion = CrossModalTransformerFusion(fusion_dim, dropout=dropout)
        else:
            raise ValueError(f"Unknown fusion_type={fusion_type!r}")

        self.regression_head = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(fusion_dim, fusion_dim // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(fusion_dim // 2, 1),
        )
        self.classification_head = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(fusion_dim, fusion_dim // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(fusion_dim // 2, 5),
        )

    def forward(self, batch: dict[str, Any]) -> dict[str, torch.Tensor]:
        text = self.text_encoder(batch["text"])
        audio = self.audio_encoder(batch["audio"], batch.get("audio_mask"))
        video = self.video_encoder(batch["video"], batch.get("video_mask"))
        fused, gates = self.fusion(text, audio, video)
        return {
            "phq_norm": self.regression_head(fused).squeeze(-1),
            "severity_logits": self.classification_head(fused),
            "gates": gates,
        }


def move_batch(batch: dict[str, Any], device: torch.device) -> dict[str, Any]:
    moved = {}
    for key, value in batch.items():
        if isinstance(value, Mapping):
            moved[key] = {inner_key: inner_value.to(device) for inner_key, inner_value in value.items()}
        elif torch.is_tensor(value):
            moved[key] = value.to(device)
        else:
            moved[key] = value
    return moved


def target_stats(dataset: DaicWozMultimodalDataset) -> dict[str, float]:
    scores = np.asarray([row.phq_score for row in dataset.rows], dtype=np.float32)
    std = float(scores.std())
    return {"mean": float(scores.mean()), "std": std if std > 1e-6 else 1.0}


def denormalize(values: torch.Tensor, stats: dict[str, float]) -> torch.Tensor:
    return (values * stats["std"] + stats["mean"]).clamp(0.0, 24.0)


def severity_sampler(dataset: DaicWozMultimodalDataset) -> WeightedRandomSampler:
    counts = Counter(severity_index(row.phq_score) for row in dataset.rows)
    weights = [1.0 / counts[severity_index(row.phq_score)] for row in dataset.rows]
    return WeightedRandomSampler(torch.as_tensor(weights, dtype=torch.double), num_samples=len(weights), replacement=True)


def infer_feature_dims(dataset: DaicWozMultimodalDataset) -> tuple[int, int]:
    sample = dataset[0]
    return int(sample["audio"].shape[1]), int(sample["video"].shape[1])


def evaluate(model: nn.Module, loader: DataLoader, device: torch.device, stats: dict[str, float]) -> dict[str, float]:
    model.eval()
    phq_true: list[float] = []
    phq_pred: list[float] = []
    cls_true: list[int] = []
    cls_pred: list[int] = []

    with torch.no_grad():
        for batch in loader:
            batch = move_batch(batch, device)
            outputs = model(batch)
            pred = denormalize(outputs["phq_norm"], stats)
            phq_true.extend(batch["phq_score"].detach().cpu().numpy().tolist())
            phq_pred.extend(pred.detach().cpu().numpy().tolist())
            cls_true.extend(batch["severity"].detach().cpu().numpy().tolist())
            cls_pred.extend(outputs["severity_logits"].argmax(dim=-1).detach().cpu().numpy().tolist())

    true = np.asarray(phq_true, dtype=np.float32)
    pred = np.asarray(phq_pred, dtype=np.float32)
    corr = float(np.corrcoef(true, pred)[0, 1]) if len(true) > 1 and np.std(pred) > 0 else 0.0
    return {
        "mae": float(mean_absolute_error(true, pred)),
        "rmse": float(np.sqrt(mean_squared_error(true, pred))),
        "f1_macro": float(f1_score(cls_true, cls_pred, average="macro", zero_division=0)),
        "correlation": corr,
    }


def train(args: argparse.Namespace) -> None:
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() and not args.cpu else "cpu")
    normalizers = load_feature_normalizers(args.normalizer_path) if args.normalizer_path else None

    train_ds = DaicWozMultimodalDataset(args.manifest, "train", args.max_audio_frames, args.max_video_frames, use_mfcc=args.use_mfcc, normalizers=normalizers)
    dev_ds = DaicWozMultimodalDataset(args.manifest, "dev", args.max_audio_frames, args.max_video_frames, use_mfcc=args.use_mfcc, normalizers=normalizers)
    test_ds = DaicWozMultimodalDataset(args.manifest, "test", args.max_audio_frames, args.max_video_frames, use_mfcc=args.use_mfcc, normalizers=normalizers)
    stats = target_stats(train_ds)
    audio_dim, video_dim = infer_feature_dims(train_ds)

    collator = ChunkedMultimodalCollator(args.text_model, args.max_text_tokens, args.max_text_chunks)
    sampler = severity_sampler(train_ds) if args.balanced_sampler else None
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=sampler is None, sampler=sampler, num_workers=args.num_workers, collate_fn=collator)
    dev_loader = DataLoader(dev_ds, batch_size=args.batch_size, shuffle=False, num_workers=args.num_workers, collate_fn=collator)
    test_loader = DataLoader(test_ds, batch_size=args.batch_size, shuffle=False, num_workers=args.num_workers, collate_fn=collator)

    model = ChunkedMultimodalPhqModel(
        text_model_name=args.text_model,
        audio_input_dim=audio_dim,
        video_input_dim=video_dim,
        fusion_dim=args.fusion_dim,
        fusion_type=args.fusion_type,
        freeze_text=not args.finetune_text,
        unfreeze_last_text_layers=args.unfreeze_last_text_layers,
        dropout=args.dropout,
    ).to(device)

    optimizer = torch.optim.AdamW((param for param in model.parameters() if param.requires_grad), lr=args.lr, weight_decay=args.weight_decay)
    regression_loss = nn.SmoothL1Loss(beta=args.huber_beta)
    ce_loss = nn.CrossEntropyLoss()
    amp_enabled = bool(args.mixed_precision and device.type == "cuda")
    scaler = torch.cuda.amp.GradScaler(enabled=amp_enabled)
    best_dev_mae = float("inf")
    best_path = output_dir / "best_model.pt"
    epochs_without_improvement = 0

    config = vars(args) | {
        "audio_input_dim": audio_dim,
        "video_input_dim": video_dim,
        "target_mean": stats["mean"],
        "target_std": stats["std"],
        "model_family": "chunked_multimodal_v2",
    }
    (output_dir / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")

    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = 0.0
        for batch in tqdm(train_loader, desc=f"epoch {epoch}"):
            batch = move_batch(batch, device)
            target_norm = (batch["phq_score"] - stats["mean"]) / stats["std"]
            optimizer.zero_grad(set_to_none=True)
            with torch.cuda.amp.autocast(enabled=amp_enabled):
                outputs = model(batch)
                loss = regression_loss(outputs["phq_norm"], target_norm) + args.classification_lambda * ce_loss(outputs["severity_logits"], batch["severity"])
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            nn.utils.clip_grad_norm_(model.parameters(), args.grad_clip)
            scaler.step(optimizer)
            scaler.update()
            running_loss += float(loss.item())

        dev_metrics = evaluate(model, dev_loader, device, stats)
        print(json.dumps({"epoch": epoch, "train_loss": running_loss / max(1, len(train_loader)), "dev": dev_metrics}, indent=2))

        if dev_metrics["mae"] < best_dev_mae - args.min_delta:
            best_dev_mae = dev_metrics["mae"]
            epochs_without_improvement = 0
            torch.save(
                {
                    "model_state": model.state_dict(),
                    "config": config,
                    "dev_metrics": dev_metrics,
                    "normalizers": normalizers,
                    "target_stats": stats,
                },
                best_path,
            )
        else:
            epochs_without_improvement += 1
            if args.patience > 0 and epochs_without_improvement >= args.patience:
                print(f"Early stopping after {epoch} epochs. Best dev MAE: {best_dev_mae:.4f}")
                break

    checkpoint = torch.load(best_path, map_location=device)
    model.load_state_dict(checkpoint["model_state"])
    test_metrics = evaluate(model, test_loader, device, stats)
    (output_dir / "test_metrics.json").write_text(json.dumps(test_metrics, indent=2), encoding="utf-8")
    print(json.dumps({"test": test_metrics}, indent=2))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--normalizer-path", default="")
    parser.add_argument("--text-model", default="roberta-base")
    parser.add_argument("--fusion-type", choices=["gated", "cross_modal"], default="gated")
    parser.add_argument("--max-text-tokens", type=int, default=192)
    parser.add_argument("--max-text-chunks", type=int, default=12)
    parser.add_argument("--max-audio-frames", type=int, default=600)
    parser.add_argument("--max-video-frames", type=int, default=300)
    parser.add_argument("--fusion-dim", type=int, default=128)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--lr", type=float, default=3e-5)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--classification-lambda", type=float, default=0.1)
    parser.add_argument("--huber-beta", type=float, default=0.5)
    parser.add_argument("--grad-clip", type=float, default=1.0)
    parser.add_argument("--dropout", type=float, default=0.4)
    parser.add_argument("--patience", type=int, default=10)
    parser.add_argument("--min-delta", type=float, default=1e-4)
    parser.add_argument("--num-workers", type=int, default=0)
    parser.add_argument("--use-mfcc", action="store_true")
    parser.add_argument("--balanced-sampler", action="store_true")
    parser.add_argument("--mixed-precision", action="store_true")
    parser.add_argument("--finetune-text", action="store_true")
    parser.add_argument("--unfreeze-last-text-layers", type=int, default=0)
    parser.add_argument("--cpu", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    train(parse_args())
