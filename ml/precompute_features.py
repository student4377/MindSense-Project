from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from tqdm import tqdm

from dataset import ManifestRow, fit_feature_normalizers, read_audio_sequence, read_video_sequence, save_feature_normalizers


def build_manifest_row(row: object) -> ManifestRow:
    return ManifestRow(
        participant_id=str(row.participant_id),
        split=str(row.split),
        phq_score=float(row.phq_score),
        transcript_path=str(row.transcript_path),
        audio_features_path=str(row.audio_features_path),
        video_features_path=str(row.video_features_path),
        audio_mfcc_path=str(getattr(row, "audio_mfcc_path", "") or ""),
    )


def precompute(args: argparse.Namespace) -> None:
    manifest_path = Path(args.manifest).expanduser().resolve()
    output_dir = Path(args.cache_dir).expanduser().resolve()
    output_manifest = Path(args.output_manifest).expanduser().resolve()
    normalizers_output = Path(args.normalizers_output).expanduser().resolve()

    audio_dir = output_dir / "audio"
    video_dir = output_dir / "video"
    audio_dir.mkdir(parents=True, exist_ok=True)
    video_dir.mkdir(parents=True, exist_ok=True)
    output_manifest.parent.mkdir(parents=True, exist_ok=True)
    normalizers_output.parent.mkdir(parents=True, exist_ok=True)

    manifest = pd.read_csv(manifest_path)
    cached_rows: list[dict[str, object]] = []

    for row in tqdm(list(manifest.itertuples(index=False)), desc="precompute"):
        manifest_row = build_manifest_row(row)
        audio = read_audio_sequence(manifest_row, args.max_audio_frames, use_mfcc=args.use_mfcc)
        video = read_video_sequence(manifest_row, args.max_video_frames)

        audio_path = audio_dir / f"{manifest_row.participant_id}.npy"
        video_path = video_dir / f"{manifest_row.participant_id}.npy"
        np.save(audio_path, audio.astype(np.float32))
        np.save(video_path, video.astype(np.float32))

        cached = row._asdict()
        cached["audio_cache_path"] = str(audio_path)
        cached["video_cache_path"] = str(video_path)
        cached_rows.append(cached)

    pd.DataFrame(cached_rows).to_csv(output_manifest, index=False)
    normalizers = fit_feature_normalizers(output_manifest, args.max_audio_frames, args.max_video_frames, use_mfcc=args.use_mfcc)
    save_feature_normalizers(normalizers_output, normalizers)

    print(f"Wrote cached manifest: {output_manifest}")
    print(f"Wrote feature cache: {output_dir}")
    print(f"Wrote train-only normalizers: {normalizers_output}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Precompute compact .npy feature tensors for faster Colab training.")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--cache-dir", required=True)
    parser.add_argument("--output-manifest", required=True)
    parser.add_argument("--normalizers-output", required=True)
    parser.add_argument("--max-audio-frames", type=int, default=600)
    parser.add_argument("--max-video-frames", type=int, default=300)
    parser.add_argument("--use-mfcc", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    precompute(parse_args())
