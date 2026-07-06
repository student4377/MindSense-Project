# MindSense Multimodal PHQ-8 Model

This folder contains the learned multimodal depression prediction scaffold for DAIC-WOZ / Extended DAIC-WOZ.

The dataset should stay outside this repository. Point the scripts at a manifest CSV where each row is one participant.

Required manifest columns:

```text
participant_id,split,phq_score,transcript_path,audio_features_path,video_features_path
```

`split` must be one of:

```text
train,dev,test
```

Training target:

```text
PHQ-8 score: continuous 0-24
Severity class: derived deterministically from PHQ-8 bands
```

Architecture:

```text
Transformer text encoder
1D CNN audio encoder over OpenSMILE feature sequences
Transformer video encoder over OpenFace pose/gaze/AU sequences
Learned gated fusion
Regression head for PHQ-8
Optional severity classification head
```

Install:

```bash
cd ml
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Media extraction tools:

```powershell
winget install --id Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements
```

OpenFace is installed as a Windows binary outside the repo:

```text
C:\Tools\OpenFace\FeatureExtraction.exe
```

If you install it somewhere else, set:

```powershell
$env:MINDSENSE_OPENFACE_BIN="C:\path\to\FeatureExtraction.exe"
$env:MINDSENSE_FFMPEG_BIN="C:\path\to\ffmpeg.exe"
```

Media API safety controls:

```powershell
$env:MINDSENSE_MAX_MEDIA_BYTES="104857600"
$env:MINDSENSE_MEDIA_DOWNLOAD_TIMEOUT_SECONDS="30"
$env:MINDSENSE_MEDIA_COMMAND_TIMEOUT_SECONDS="180"
```

Local media paths are blocked by default for `/predict-from-media`. Enable only for trusted local testing:

```powershell
$env:MINDSENSE_ALLOW_LOCAL_MEDIA_PATHS="true"
```

Multilingual audio transcript support:

```powershell
$env:MINDSENSE_ENABLE_AUDIO_TRANSCRIPT="true"
$env:MINDSENSE_WHISPER_MODEL="base"
$env:MINDSENSE_WHISPER_TASK="translate"
```

When enabled and `faster-whisper` is installed, `/predict-from-media` converts the browser audio to WAV, extracts acoustic OpenSMILE/librosa features, and also creates an English speech transcript. Urdu and English speech are auto-detected by Whisper; with `MINDSENSE_WHISPER_TASK=translate`, Urdu speech is translated into English before being appended to the text context used by the existing RoBERTa encoder. If Whisper is unavailable, learned audio/video inference still runs using acoustic features only.

Build manifest:

```bash
python build_manifest.py --data-root C:\Users\shahrukh\Desktop\Model_Training --output C:\Users\shahrukh\Desktop\Model_Training\manifest.csv
```

Train:

```bash
python precompute_features.py --manifest C:\Users\shahrukh\Desktop\Model_Training\manifest.csv --cache-dir C:\Users\shahrukh\Desktop\Model_Training\feature_cache_roberta --output-manifest C:\Users\shahrukh\Desktop\Model_Training\manifest_cached_roberta.csv --normalizers-output C:\Users\shahrukh\Desktop\Model_Training\feature_normalizers_roberta.json --use-mfcc
python train.py --manifest C:\Users\shahrukh\Desktop\Model_Training\manifest_cached_roberta.csv --normalizer-path C:\Users\shahrukh\Desktop\Model_Training\feature_normalizers_roberta.json --output-dir runs\mindsense-mm-v1 --text-model roberta-base --fusion-type gated --use-mfcc
```

Colab:

```text
See COLAB_GUIDE.md and colab_mindsense_training.py.
```

Run API:

```bash
python predict_api.py
```

By default this loads:

```text
artifacts/mindsense_roberta_gated_tuned_v2/best_model.pt
```

Use `--checkpoint path\to\best_model.pt` to run a different checkpoint.

Then set in the website `.env`:

```text
VITE_ML_API_URL=http://127.0.0.1:8000
```

The website sends Supabase signed URLs to `/predict-from-media`. The API converts browser `.webm` media with FFmpeg, extracts 62 audio features with OpenSMILE/librosa, extracts 49 video features with OpenFace, then runs the learned multimodal model.
