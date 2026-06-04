from __future__ import annotations

from dataclasses import dataclass
import json
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
    "frametime",
    "time",
    "start_time",
    "end_time",
    "confidence",
    "success",
    "participant_id",
    "name",
    "file",
}


def read_csv_auto(path: str | Path) -> pd.DataFrame:
    file_path = Path(path)
    with file_path.open("r", encoding="utf-8-sig", errors="ignore") as file:
        header = file.readline()
    delimiter = ";" if header.count(";") > header.count(",") else ","
    return pd.read_csv(file_path, sep=delimiter)


@dataclass
class ManifestRow:
    participant_id: str
    split: str
    phq_score: float
    transcript_path: str
    audio_features_path: str
    video_features_path: str
    audio_mfcc_path: str = ""
    audio_cache_path: str = ""
    video_cache_path: str = ""


def read_text(path: str | Path) -> str:
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(file_path)
    if file_path.suffix.lower() == ".csv":
        df = read_csv_auto(file_path)
        text_columns = [col for col in df.columns if col.lower() in {"value", "text", "transcript", "utterance", "dialogue"}]
        if text_columns:
            return " ".join(df[text_columns[0]].dropna().astype(str).tolist())
        return " ".join(df.select_dtypes(include=["object"]).fillna("").astype(str).agg(" ".join, axis=1).tolist())
    return file_path.read_text(encoding="utf-8", errors="ignore")


def read_feature_sequence(path: str | Path, max_frames: int) -> np.ndarray:
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(file_path)
    df = read_csv_auto(file_path)

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


def resample_sequence(values: np.ndarray, length: int) -> np.ndarray:
    if values.shape[0] == length:
        return values
    if values.shape[0] == 0:
        return np.zeros((length, values.shape[1]), dtype=np.float32)
    idx = np.linspace(0, values.shape[0] - 1, length).astype(int)
    return values[idx]


def apply_normalizer(values: np.ndarray, normalizer: dict[str, list[float]] | None) -> np.ndarray:
    if normalizer is None:
        return values
    mean = np.asarray(normalizer["mean"], dtype=np.float32)
    std = np.asarray(normalizer["std"], dtype=np.float32)
    return ((values - mean) / std).astype(np.float32)


def read_audio_sequence(row: ManifestRow, max_frames: int, use_mfcc: bool) -> np.ndarray:
    if row.audio_cache_path and Path(row.audio_cache_path).exists():
        return np.load(row.audio_cache_path).astype(np.float32)
    audio = read_feature_sequence(row.audio_features_path, max_frames)
    if use_mfcc and row.audio_mfcc_path and Path(row.audio_mfcc_path).exists():
        mfcc = read_feature_sequence(row.audio_mfcc_path, max_frames)
        mfcc = resample_sequence(mfcc, audio.shape[0])
        audio = np.concatenate([audio, mfcc], axis=1)
    return audio.astype(np.float32)


def read_video_sequence(row: ManifestRow, max_frames: int) -> np.ndarray:
    if row.video_cache_path and Path(row.video_cache_path).exists():
        return np.load(row.video_cache_path).astype(np.float32)
    return read_feature_sequence(row.video_features_path, max_frames)


def make_normalizer(sum_values: np.ndarray, sum_squares: np.ndarray, count: int) -> dict[str, list[float]]:
    mean = sum_values / max(count, 1)
    variance = (sum_squares / max(count, 1)) - np.square(mean)
    std = np.sqrt(np.maximum(variance, 1e-8))
    std[std < 1e-6] = 1.0
    return {"mean": mean.astype(float).tolist(), "std": std.astype(float).tolist()}


def fit_feature_normalizers(
    manifest_path: str | Path,
    max_audio_frames: int,
    max_video_frames: int,
    use_mfcc: bool = False,
) -> dict[str, dict[str, list[float]]]:
    manifest = pd.read_csv(manifest_path)
    audio_sum: np.ndarray | None = None
    audio_sum_squares: np.ndarray | None = None
    video_sum: np.ndarray | None = None
    video_sum_squares: np.ndarray | None = None
    audio_count = 0
    video_count = 0

    for row in manifest.itertuples(index=False):
        if str(row.split).lower() != "train":
            continue
        manifest_row = ManifestRow(
            participant_id=str(row.participant_id),
            split=str(row.split),
            phq_score=float(row.phq_score),
            transcript_path=str(row.transcript_path),
            audio_features_path=str(row.audio_features_path),
            video_features_path=str(row.video_features_path),
            audio_mfcc_path=str(getattr(row, "audio_mfcc_path", "") or ""),
            audio_cache_path=str(getattr(row, "audio_cache_path", "") or ""),
            video_cache_path=str(getattr(row, "video_cache_path", "") or ""),
        )
        audio = read_audio_sequence(manifest_row, max_audio_frames, use_mfcc)
        video = read_video_sequence(manifest_row, max_video_frames)

        if audio_sum is None:
            audio_sum = np.zeros(audio.shape[1], dtype=np.float64)
            audio_sum_squares = np.zeros(audio.shape[1], dtype=np.float64)
        if video_sum is None:
            video_sum = np.zeros(video.shape[1], dtype=np.float64)
            video_sum_squares = np.zeros(video.shape[1], dtype=np.float64)

        audio_sum += audio.sum(axis=0)
        audio_sum_squares += np.square(audio.astype(np.float64)).sum(axis=0)
        audio_count += audio.shape[0]
        video_sum += video.sum(axis=0)
        video_sum_squares += np.square(video.astype(np.float64)).sum(axis=0)
        video_count += video.shape[0]

    if audio_sum is None or audio_sum_squares is None or video_sum is None or video_sum_squares is None:
        raise ValueError("Cannot fit normalizers because no train rows were found")

    return {
        "audio": make_normalizer(audio_sum, audio_sum_squares, audio_count),
        "video": make_normalizer(video_sum, video_sum_squares, video_count),
    }


def save_feature_normalizers(path: str | Path, normalizers: dict[str, dict[str, list[float]]]) -> None:
    Path(path).write_text(json.dumps(normalizers, indent=2), encoding="utf-8")


def load_feature_normalizers(path: str | Path) -> dict[str, dict[str, list[float]]]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


class DaicWozMultimodalDataset(Dataset):
    def __init__(
        self,
        manifest_path: str | Path,
        split: str,
        max_audio_frames: int = 600,
        max_video_frames: int = 600,
        use_mfcc: bool = False,
        normalizers: dict[str, dict[str, list[float]]] | None = None,
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
                audio_mfcc_path=str(getattr(row, "audio_mfcc_path", "") or ""),
                audio_cache_path=str(getattr(row, "audio_cache_path", "") or ""),
                video_cache_path=str(getattr(row, "video_cache_path", "") or ""),
            )
            for row in manifest.itertuples(index=False)
            if str(row.split).lower() == split
        ]
        if not self.rows:
            raise ValueError(f"No rows found for split={split}")
        self.max_audio_frames = max_audio_frames
        self.max_video_frames = max_video_frames
        self.use_mfcc = use_mfcc
        self.normalizers = normalizers

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> dict[str, Any]:
        row = self.rows[index]
        return {
            "participant_id": row.participant_id,
            "text": read_text(row.transcript_path),
            "audio": torch.from_numpy(apply_normalizer(read_audio_sequence(row, self.max_audio_frames, self.use_mfcc), self.normalizers.get("audio") if self.normalizers else None)),
            "video": torch.from_numpy(apply_normalizer(read_video_sequence(row, self.max_video_frames), self.normalizers.get("video") if self.normalizers else None)),
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
