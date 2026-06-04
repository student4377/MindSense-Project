from __future__ import annotations

import argparse
import csv
import shutil
from pathlib import Path


DEFAULT_PROJECT_ROOT = Path.home() / "Desktop" / "Project" / "MindSense-main" / "MindSense-main"
DEFAULT_DATA_ROOT = Path.home() / "Desktop" / "Model_Training"
DEFAULT_PACKAGE_ROOT = Path.home() / "Desktop" / "MindSense_Colab_Upload"

ML_EXCLUDES = {".venv", "__pycache__", "runs", ".pytest_cache"}
DATA_FILES = [
    "manifest.csv",
    "manifest_missing_files.csv",
    "feature_normalizers_roberta.json",
    "train_split.csv",
    "dev_split.csv",
    "test_split.csv",
    "Detailed_PHQ8_Labels.csv",
    "detailed_lables.csv",
    "metadata_mapped.csv",
    "E-DAIC Manual.pdf",
]


def ignore_ml_files(_: str, names: list[str]) -> set[str]:
    ignored = set()
    for name in names:
        if name in ML_EXCLUDES or name.endswith(".pyc"):
            ignored.add(name)
    return ignored


def copy_replace(src: Path, dst: Path, ignore=None) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst, ignore=ignore)


def copy_file_if_exists(src: Path, dst: Path) -> None:
    if src.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def write_colab_cached_manifest(data_root: Path, output_path: Path, colab_data_root: str) -> None:
    local_manifest = data_root / "manifest_cached_roberta_local.csv"
    if not local_manifest.exists():
        raise FileNotFoundError(f"Missing cached local manifest: {local_manifest}")

    with local_manifest.open("r", newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))
        fieldnames = list(rows[0].keys()) if rows else []

    for extra in ["audio_cache_path", "video_cache_path"]:
        if extra not in fieldnames:
            fieldnames.append(extra)

    colab_root = colab_data_root.rstrip("/")
    for row in rows:
        participant_id = str(row["participant_id"]).strip()
        row["transcript_path"] = f"{colab_root}/Text/{participant_id}_P/{participant_id}_Transcript.csv"
        row["audio_features_path"] = f"{colab_root}/feature_cache_roberta/audio/{participant_id}.npy"
        row["video_features_path"] = f"{colab_root}/feature_cache_roberta/video/{participant_id}.npy"
        row["audio_mfcc_path"] = ""
        row["audio_cache_path"] = f"{colab_root}/feature_cache_roberta/audio/{participant_id}.npy"
        row["video_cache_path"] = f"{colab_root}/feature_cache_roberta/video/{participant_id}.npy"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_instructions(package_root: Path) -> None:
    text = """MindSense Colab Upload Package

Upload these two folders to Google Drive:

1. MindSenseProject
   Destination: MyDrive/MindSenseProject

2. MindSenseData
   Destination: MyDrive/MindSenseData

Then open:

MyDrive/MindSenseProject/ml/colab_mindsense_training.ipynb

In Colab choose:

Runtime -> Change runtime type -> T4 GPU

The package already contains cached features, so the notebook can skip raw CSV precompute and start training directly.
"""
    (package_root / "UPLOAD_INSTRUCTIONS.txt").write_text(text, encoding="utf-8")


def prepare(args: argparse.Namespace) -> None:
    project_root = Path(args.project_root).expanduser().resolve()
    data_root = Path(args.data_root).expanduser().resolve()
    package_root = Path(args.package_root).expanduser().resolve()

    package_root.mkdir(parents=True, exist_ok=True)
    project_package = package_root / "MindSenseProject"
    data_package = package_root / "MindSenseData"

    ml_src = project_root / "ml"
    ml_dst = project_package / "ml"
    text_src = data_root / "Text"
    text_dst = data_package / "Text"
    cache_src = data_root / "feature_cache_roberta"
    cache_dst = data_package / "feature_cache_roberta"

    print(f"Copying ML code to {ml_dst}")
    copy_replace(ml_src, ml_dst, ignore=ignore_ml_files)

    print(f"Copying transcripts to {text_dst}")
    copy_replace(text_src, text_dst)

    print(f"Copying cached features to {cache_dst}")
    copy_replace(cache_src, cache_dst)

    for filename in DATA_FILES:
        copy_file_if_exists(data_root / filename, data_package / filename)

    write_colab_cached_manifest(
        data_root=data_root,
        output_path=data_package / "manifest_cached_roberta.csv",
        colab_data_root=args.colab_data_root,
    )
    write_instructions(package_root)

    print(f"Prepared upload package: {package_root}")
    print("Upload MindSenseProject and MindSenseData from that folder to Google Drive MyDrive.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare compact Google Drive upload package for MindSense Colab training.")
    parser.add_argument("--project-root", default=str(DEFAULT_PROJECT_ROOT))
    parser.add_argument("--data-root", default=str(DEFAULT_DATA_ROOT))
    parser.add_argument("--package-root", default=str(DEFAULT_PACKAGE_ROOT))
    parser.add_argument("--colab-data-root", default="/content/drive/MyDrive/MindSenseData")
    return parser.parse_args()


if __name__ == "__main__":
    prepare(parse_args())
