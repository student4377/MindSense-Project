from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset
from transformers import AutoTokenizer

from phq import severity_index


NON_FEATURE_COLUMNS = {
    "frame",
    "timestamp",
    "timestamp_sec",
    "confidence",
    "success",
    "participant_id",
    "name",
    "file",
}


@dataclass
class ManifestRow:
    participant_id: str
    split: str
    phq_score: float
    transcript_path: str
    audio_features_path: str
    video_features_path: str


def read_text(path: str | Path) -> str:
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(file_path)
    if file_path.suffix.lower() == ".csv":
        df = pd.read_csv(file_path)
        text_columns = [col for col in df.columns if col.lower() in {"value", "text", "transcript", "utterance", "dialogue"}]
        if text_columns:
            return " ".join(df[text_columns[0]].dropna().astype(str).tolist())
        return " ".join(df.select_dtypes(include=["object"]).fillna("").astype(str).agg(" ".join, axis=1).tolist())
    return file_path.read_text(encoding="utf-8", errors="ignore")


def read_feature_sequence(path: str | Path, max_frames: int) -> np.ndarray:
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(file_path)
    df = pd.read_csv(file_path)

    if "success" in df.columns:
        df = df[df["success"].fillna(0).astype(float) >= 1]
    if "confidence" in df.columns:
        df = df[df["confidence"].fillna(0).astype(float) >= 0.8]

    numeric = df.select_dtypes(include=[np.number]).copy()
    feature_cols = [col for col in numeric.columns if col.lower().strip() not in NON_FEATURE_COLUMNS]
    numeric = numeric[feature_cols]
    numeric = numeric.replace([np.inf, -np.inf], np.nan).fillna(0.0)

    if numeric.empty:
        raise ValueError(f"No numeric feature columns found in {file_path}")

    values = numeric.to_numpy(dtype=np.float32)
    if values.shape[0] > max_frames:
        idx = np.linspace(0, values.shape[0] - 1, max_frames).astype(int)
        values = values[idx]
    return values


class DaicWozMultimodalDataset(Dataset):
    def __init__(
        self,
        manifest_path: str | Path,
        split: str,
        max_audio_frames: int = 600,
        max_video_frames: int = 600,
    ) -> None:
        manifest = pd.read_csv(manifest_path)
        required = {"participant_id", "split", "phq_score", "transcript_path", "audio_features_path", "video_features_path"}
        missing = required - set(manifest.columns)
        if missing:
            raise ValueError(f"Manifest missing columns: {sorted(missing)}")

        self.rows = [
            ManifestRow(
                participant_id=str(row.participant_id),
                split=str(row.split),
                phq_score=float(row.phq_score),
                transcript_path=str(row.transcript_path),
                audio_features_path=str(row.audio_features_path),
                video_features_path=str(row.video_features_path),
            )
            for row in manifest.itertuples(index=False)
            if str(row.split).lower() == split
        ]
        if not self.rows:
            raise ValueError(f"No rows found for split={split}")
        self.max_audio_frames = max_audio_frames
        self.max_video_frames = max_video_frames

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> dict[str, Any]:
        row = self.rows[index]
        return {
            "participant_id": row.participant_id,
            "text": read_text(row.transcript_path),
            "audio": torch.from_numpy(read_feature_sequence(row.audio_features_path, self.max_audio_frames)),
            "video": torch.from_numpy(read_feature_sequence(row.video_features_path, self.max_video_frames)),
            "phq_score": torch.tensor(row.phq_score, dtype=torch.float32),
            "severity": torch.tensor(severity_index(row.phq_score), dtype=torch.long),
        }


def pad_sequence_batch(sequences: list[torch.Tensor]) -> tuple[torch.Tensor, torch.Tensor]:
    lengths = torch.tensor([sequence.shape[0] for sequence in sequences], dtype=torch.long)
    feature_dim = sequences[0].shape[1]
    max_len = int(lengths.max().item())
    batch = torch.zeros(len(sequences), max_len, feature_dim, dtype=torch.float32)
    mask = torch.ones(len(sequences), max_len, dtype=torch.bool)
    for index, sequence in enumerate(sequences):
        length = sequence.shape[0]
        batch[index, :length] = sequence
        mask[index, :length] = False
    return batch, mask


class MultimodalCollator:
    def __init__(self, text_model_name: str, max_text_tokens: int = 256) -> None:
        self.tokenizer = AutoTokenizer.from_pretrained(text_model_name)
        self.max_text_tokens = max_text_tokens

    def __call__(self, batch: list[dict[str, Any]]) -> dict[str, Any]:
        tokenized = self.tokenizer(
            [item["text"] for item in batch],
            padding=True,
            truncation=True,
            max_length=self.max_text_tokens,
            return_tensors="pt",
        )
        audio, audio_mask = pad_sequence_batch([item["audio"] for item in batch])
        video, video_mask = pad_sequence_batch([item["video"] for item in batch])
        return {
            "participant_id": [item["participant_id"] for item in batch],
            "text": tokenized,
            "audio": audio,
            "audio_mask": audio_mask,
            "video": video,
            "video_mask": video_mask,
            "phq_score": torch.stack([item["phq_score"] for item in batch]),
            "severity": torch.stack([item["severity"] for item in batch]),
        }
