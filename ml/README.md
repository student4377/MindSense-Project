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

Note: the API scaffold supports the model contract now. Raw browser `.webm` feature extraction must use the same extraction process as training, such as OpenSMILE for audio and OpenFace for video, before production use.
