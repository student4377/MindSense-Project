# MindSense Colab Training Runner
#
# Open this file in Google Colab or copy each cell into a notebook.
# Recommended Google Drive layout:
#
# /content/drive/MyDrive/MindSenseProject/ml
# /content/drive/MyDrive/MindSenseData/Text
# /content/drive/MyDrive/MindSenseData/Audio
# /content/drive/MyDrive/MindSenseData/Video
# /content/drive/MyDrive/MindSenseData/manifest.csv
#
# The `ml` folder should be this project's ml folder.

# %%
from google.colab import drive
drive.mount("/content/drive")

# %%
!nvidia-smi

# %%
!pip -q install fastapi "uvicorn[standard]" pydantic numpy pandas scikit-learn torch transformers tqdm

# %%
import os
import sys
import subprocess
from pathlib import Path

PROJECT_ROOT = Path("/content/drive/MyDrive/MindSenseProject")
DATA_ROOT = Path("/content/drive/MyDrive/MindSenseData")
ML_DIR = PROJECT_ROOT / "ml"
MANIFEST = DATA_ROOT / "manifest.csv"
CACHE_DIR = DATA_ROOT / "feature_cache_roberta"
CACHED_MANIFEST = DATA_ROOT / "manifest_cached_roberta.csv"
NORMALIZERS = DATA_ROOT / "feature_normalizers_roberta.json"

sys.path.insert(0, str(ML_DIR))
print("ML dir:", ML_DIR)
print("Manifest:", MANIFEST)
print("Manifest exists:", MANIFEST.exists())

# %%
# If you uploaded the compact package, cached features are already present.
# If you uploaded raw Audio/Video CSV folders instead, this cell rebuilds the cache once.
if CACHED_MANIFEST.exists() and NORMALIZERS.exists():
    print("Using existing cached manifest and normalizers.")
else:
    subprocess.run(["python", str(ML_DIR / "build_manifest.py"), "--data-root", str(DATA_ROOT), "--output", str(MANIFEST)], check=True)
    subprocess.run(
        [
            "python",
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
        ],
        check=True,
    )

# %%
# Model A: RoBERTa + OpenSMILE/eGeMAPS+MFCC + OpenFace -> Gated Fusion -> PHQ
GATED_OUTPUT = ML_DIR / "runs" / "mindsense_roberta_gated"
!python "{ML_DIR / 'train.py'}" \
  --manifest "{CACHED_MANIFEST}" \
  --output-dir "{GATED_OUTPUT}" \
  --normalizer-path "{NORMALIZERS}" \
  --text-model roberta-base \
  --fusion-type gated \
  --use-mfcc \
  --mixed-precision \
  --max-text-tokens 256 \
  --max-audio-frames 600 \
  --max-video-frames 300 \
  --fusion-dim 256 \
  --batch-size 4 \
  --epochs 30 \
  --patience 6 \
  --lr 2e-4 \
  --classification-lambda 0.25

# %%
# Model B: same encoders -> Cross-modal Transformer Fusion -> PHQ
CROSS_OUTPUT = ML_DIR / "runs" / "mindsense_roberta_cross_modal"
!python "{ML_DIR / 'train.py'}" \
  --manifest "{CACHED_MANIFEST}" \
  --output-dir "{CROSS_OUTPUT}" \
  --normalizer-path "{NORMALIZERS}" \
  --text-model roberta-base \
  --fusion-type cross_modal \
  --use-mfcc \
  --mixed-precision \
  --max-text-tokens 256 \
  --max-audio-frames 600 \
  --max-video-frames 300 \
  --fusion-dim 256 \
  --batch-size 4 \
  --epochs 30 \
  --patience 6 \
  --lr 2e-4 \
  --classification-lambda 0.25

# %%
# Phase 2 optional fine-tuning: unfreeze last 2 RoBERTa layers.
# Run this only after Model A/B baseline works and you have time/GPU budget.
FINE_TUNE_OUTPUT = ML_DIR / "runs" / "mindsense_roberta_cross_modal_ft2"
!python "{ML_DIR / 'train.py'}" \
  --manifest "{CACHED_MANIFEST}" \
  --output-dir "{FINE_TUNE_OUTPUT}" \
  --normalizer-path "{NORMALIZERS}" \
  --text-model roberta-base \
  --fusion-type cross_modal \
  --use-mfcc \
  --mixed-precision \
  --finetune-text \
  --unfreeze-last-text-layers 2 \
  --max-text-tokens 256 \
  --max-audio-frames 600 \
  --max-video-frames 300 \
  --fusion-dim 256 \
  --batch-size 2 \
  --epochs 15 \
  --patience 4 \
  --lr 5e-5 \
  --classification-lambda 0.25

# %%
# V2 accuracy experiment: chunked full-transcript RoBERTa + gated fusion.
# This is intended to beat the current best test MAE 5.396.
CHUNKED_V2_OUTPUT = ML_DIR / "runs" / "mindsense_roberta_gated_chunked_v2"
!python "{ML_DIR / 'train_chunked_v2.py'}" \
  --manifest "{CACHED_MANIFEST}" \
  --output-dir "{CHUNKED_V2_OUTPUT}" \
  --normalizer-path "{NORMALIZERS}" \
  --text-model roberta-base \
  --fusion-type gated \
  --use-mfcc \
  --balanced-sampler \
  --mixed-precision \
  --max-text-tokens 192 \
  --max-text-chunks 12 \
  --max-audio-frames 600 \
  --max-video-frames 300 \
  --fusion-dim 128 \
  --dropout 0.4 \
  --batch-size 2 \
  --epochs 50 \
  --patience 10 \
  --lr 3e-5 \
  --huber-beta 0.5 \
  --classification-lambda 0.1

# %%
import json

for name, output in {
    "gated": GATED_OUTPUT,
    "cross_modal": CROSS_OUTPUT,
    "cross_modal_ft2": FINE_TUNE_OUTPUT,
    "chunked_v2": CHUNKED_V2_OUTPUT,
}.items():
    metrics_path = output / "test_metrics.json"
    if metrics_path.exists():
        print(name, json.loads(metrics_path.read_text()))
    else:
        print(name, "not run yet")
