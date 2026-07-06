from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


"""
MindSense Colab training runner.

Use this file from Google Colab or run it as a normal Python script after
mounting Google Drive. Dataset files should stay outside the app repository.

Recommended Drive layout:
  /content/drive/MyDrive/MindSenseProject/ml
  /content/drive/MyDrive/MindSenseData/Text
  /content/drive/MyDrive/MindSenseData/Audio
  /content/drive/MyDrive/MindSenseData/Video
  /content/drive/MyDrive/MindSenseData/manifest.csv
"""


PROJECT_ROOT = Path(os.environ.get("MINDSENSE_COLAB_PROJECT_ROOT", "/content/drive/MyDrive/MindSenseProject"))
DATA_ROOT = Path(os.environ.get("MINDSENSE_COLAB_DATA_ROOT", "/content/drive/MyDrive/MindSenseData"))
ML_DIR = PROJECT_ROOT / "ml"
MANIFEST = DATA_ROOT / "manifest.csv"
CACHE_DIR = DATA_ROOT / "feature_cache_roberta"
CACHED_MANIFEST = DATA_ROOT / "manifest_cached_roberta.csv"
NORMALIZERS = DATA_ROOT / "feature_normalizers_roberta.json"


def run_command(command: list[str], check: bool = True) -> None:
    print(">", " ".join(command))
    subprocess.run(command, check=check)


def mount_drive_if_colab() -> None:
    try:
        from google.colab import drive  # type: ignore
    except ImportError:
        print("Google Colab is not available; assuming Drive is already mounted or paths are local.")
        return
    drive.mount("/content/drive")


def install_dependencies() -> None:
    run_command(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "-q",
            "fastapi",
            "uvicorn[standard]",
            "pydantic",
            "numpy",
            "pandas",
            "scikit-learn",
            "torch",
            "transformers",
            "tqdm",
        ]
    )


def print_environment() -> None:
    run_command(["nvidia-smi"], check=False)
    sys.path.insert(0, str(ML_DIR))
    print("ML dir:", ML_DIR)
    print("Manifest:", MANIFEST)
    print("Manifest exists:", MANIFEST.exists())


def prepare_manifest_cache() -> None:
    if CACHED_MANIFEST.exists() and NORMALIZERS.exists():
        print("Using existing cached manifest and normalizers.")
        return

    run_command([sys.executable, str(ML_DIR / "build_manifest.py"), "--data-root", str(DATA_ROOT), "--output", str(MANIFEST)])
    run_command(
        [
            sys.executable,
            str(ML_DIR / "precompute_features.py"),
            "--manifest",
            str(MANIFEST),
            "--cache-dir",
            str(CACHE_DIR),
            "--output-manifest",
            str(CACHED_MANIFEST),
            "--normalizers-output",
            str(NORMALIZERS),
            "--use-mfcc",
            "--max-audio-frames",
            "600",
            "--max-video-frames",
            "300",
        ]
    )


def train_model(output_dir: Path, fusion_type: str, extra_args: list[str] | None = None) -> None:
    command = [
        sys.executable,
        str(ML_DIR / "train.py"),
        "--manifest",
        str(CACHED_MANIFEST),
        "--output-dir",
        str(output_dir),
        "--normalizer-path",
        str(NORMALIZERS),
        "--text-model",
        "roberta-base",
        "--fusion-type",
        fusion_type,
        "--use-mfcc",
        "--mixed-precision",
        "--max-text-tokens",
        "256",
        "--max-audio-frames",
        "600",
        "--max-video-frames",
        "300",
        "--fusion-dim",
        "256",
        "--batch-size",
        "4",
        "--epochs",
        "30",
        "--patience",
        "6",
        "--lr",
        "2e-4",
        "--classification-lambda",
        "0.25",
    ]
    if extra_args:
        command.extend(extra_args)
    run_command(command)


def train_chunked_v2(output_dir: Path) -> None:
    run_command(
        [
            sys.executable,
            str(ML_DIR / "train_chunked_v2.py"),
            "--manifest",
            str(CACHED_MANIFEST),
            "--output-dir",
            str(output_dir),
            "--normalizer-path",
            str(NORMALIZERS),
            "--text-model",
            "roberta-base",
            "--fusion-type",
            "gated",
            "--use-mfcc",
            "--balanced-sampler",
            "--mixed-precision",
            "--max-text-tokens",
            "192",
            "--max-text-chunks",
            "12",
            "--max-audio-frames",
            "600",
            "--max-video-frames",
            "300",
            "--fusion-dim",
            "128",
            "--dropout",
            "0.4",
            "--batch-size",
            "2",
            "--epochs",
            "50",
            "--patience",
            "10",
            "--lr",
            "3e-5",
            "--huber-beta",
            "0.5",
            "--classification-lambda",
            "0.1",
        ]
    )


def print_metrics(outputs: dict[str, Path]) -> None:
    for name, output in outputs.items():
        metrics_path = output / "test_metrics.json"
        if metrics_path.exists():
            print(name, json.loads(metrics_path.read_text(encoding="utf-8")))
        else:
            print(name, "not run yet")


def main() -> None:
    mount_drive_if_colab()
    install_dependencies()
    print_environment()
    prepare_manifest_cache()

    outputs = {
        "gated": ML_DIR / "runs" / "mindsense_roberta_gated",
        "cross_modal": ML_DIR / "runs" / "mindsense_roberta_cross_modal",
        "cross_modal_ft2": ML_DIR / "runs" / "mindsense_roberta_cross_modal_ft2",
        "chunked_v2": ML_DIR / "runs" / "mindsense_roberta_gated_chunked_v2",
    }

    train_model(outputs["gated"], "gated")
    train_model(outputs["cross_modal"], "cross_modal")
    train_model(
        outputs["cross_modal_ft2"],
        "cross_modal",
        [
            "--finetune-text",
            "--unfreeze-last-text-layers",
            "2",
            "--batch-size",
            "2",
            "--epochs",
            "15",
            "--patience",
            "4",
            "--lr",
            "5e-5",
        ],
    )
    train_chunked_v2(outputs["chunked_v2"])
    print_metrics(outputs)


if __name__ == "__main__":
    main()
