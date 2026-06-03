from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import f1_score, mean_absolute_error, mean_squared_error
from torch import nn
from torch.utils.data import DataLoader
from tqdm import tqdm

from dataset import DaicWozMultimodalDataset, MultimodalCollator
from models import MultimodalPhqModel


def move_batch(batch: dict, device: torch.device) -> dict:
    moved = {}
    for key, value in batch.items():
        if isinstance(value, dict):
            moved[key] = {inner_key: inner_value.to(device) for inner_key, inner_value in value.items()}
        elif torch.is_tensor(value):
            moved[key] = value.to(device)
        else:
            moved[key] = value
    return moved


def infer_feature_dims(dataset: DaicWozMultimodalDataset) -> tuple[int, int]:
    sample = dataset[0]
    return int(sample["audio"].shape[1]), int(sample["video"].shape[1])


def evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> dict[str, float]:
    model.eval()
    phq_true: list[float] = []
    phq_pred: list[float] = []
    cls_true: list[int] = []
    cls_pred: list[int] = []

    with torch.no_grad():
        for batch in loader:
            batch = move_batch(batch, device)
            outputs = model(batch)
            phq_true.extend(batch["phq_score"].detach().cpu().numpy().tolist())
            phq_pred.extend(outputs["phq"].detach().cpu().numpy().tolist())
            cls_true.extend(batch["severity"].detach().cpu().numpy().tolist())
            cls_pred.extend(outputs["severity_logits"].argmax(dim=-1).detach().cpu().numpy().tolist())

    true = np.asarray(phq_true, dtype=np.float32)
    pred = np.asarray(phq_pred, dtype=np.float32)
    corr = float(np.corrcoef(true, pred)[0, 1]) if len(true) > 1 and np.std(pred) > 0 else 0.0
    return {
        "mae": float(mean_absolute_error(true, pred)),
        "rmse": float(mean_squared_error(true, pred, squared=False)),
        "f1_macro": float(f1_score(cls_true, cls_pred, average="macro")),
        "correlation": corr,
    }


def train(args: argparse.Namespace) -> None:
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() and not args.cpu else "cpu")

    train_ds = DaicWozMultimodalDataset(args.manifest, "train", args.max_audio_frames, args.max_video_frames)
    dev_ds = DaicWozMultimodalDataset(args.manifest, "dev", args.max_audio_frames, args.max_video_frames)
    test_ds = DaicWozMultimodalDataset(args.manifest, "test", args.max_audio_frames, args.max_video_frames)
    audio_dim, video_dim = infer_feature_dims(train_ds)

    collator = MultimodalCollator(args.text_model, args.max_text_tokens)
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=0, collate_fn=collator)
    dev_loader = DataLoader(dev_ds, batch_size=args.batch_size, shuffle=False, num_workers=0, collate_fn=collator)
    test_loader = DataLoader(test_ds, batch_size=args.batch_size, shuffle=False, num_workers=0, collate_fn=collator)

    model = MultimodalPhqModel(
        text_model_name=args.text_model,
        audio_input_dim=audio_dim,
        video_input_dim=video_dim,
        fusion_dim=args.fusion_dim,
        freeze_text=not args.finetune_text,
    ).to(device)

    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    mse_loss = nn.MSELoss()
    ce_loss = nn.CrossEntropyLoss()
    best_dev_mae = float("inf")
    best_path = output_dir / "best_model.pt"

    config = vars(args) | {"audio_input_dim": audio_dim, "video_input_dim": video_dim}
    (output_dir / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")

    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = 0.0
        for batch in tqdm(train_loader, desc=f"epoch {epoch}"):
            batch = move_batch(batch, device)
            optimizer.zero_grad(set_to_none=True)
            outputs = model(batch)
            loss = mse_loss(outputs["phq"], batch["phq_score"]) + args.classification_lambda * ce_loss(outputs["severity_logits"], batch["severity"])
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), args.grad_clip)
            optimizer.step()
            running_loss += float(loss.item())

        dev_metrics = evaluate(model, dev_loader, device)
        print(json.dumps({"epoch": epoch, "train_loss": running_loss / max(1, len(train_loader)), "dev": dev_metrics}, indent=2))
        if dev_metrics["mae"] < best_dev_mae:
            best_dev_mae = dev_metrics["mae"]
            torch.save(
                {
                    "model_state": model.state_dict(),
                    "config": config,
                    "dev_metrics": dev_metrics,
                },
                best_path,
            )

    checkpoint = torch.load(best_path, map_location=device)
    model.load_state_dict(checkpoint["model_state"])
    test_metrics = evaluate(model, test_loader, device)
    (output_dir / "test_metrics.json").write_text(json.dumps(test_metrics, indent=2), encoding="utf-8")
    print(json.dumps({"test": test_metrics}, indent=2))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output-dir", default="runs/mindsense-mm-v1")
    parser.add_argument("--text-model", default="distilbert-base-uncased")
    parser.add_argument("--max-text-tokens", type=int, default=256)
    parser.add_argument("--max-audio-frames", type=int, default=600)
    parser.add_argument("--max-video-frames", type=int, default=600)
    parser.add_argument("--fusion-dim", type=int, default=256)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--classification-lambda", type=float, default=0.25)
    parser.add_argument("--grad-clip", type=float, default=1.0)
    parser.add_argument("--finetune-text", action="store_true")
    parser.add_argument("--cpu", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    train(parse_args())
