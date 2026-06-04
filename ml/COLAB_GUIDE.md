# MindSense Colab Training Guide

Use Colab GPU for the serious training runs. CPU will work for smoke tests, but it is too slow for the final model.

## 1. Prepare Google Drive

Create these folders:

```text
MyDrive/MindSenseProject/ml
MyDrive/MindSenseData/Text
MyDrive/MindSenseData/Audio
MyDrive/MindSenseData/Video
```

Upload this repository's `ml` folder into:

```text
MyDrive/MindSenseProject/ml
```

Fast path: upload the compact package created at:

```text
C:\Users\shahrukh\Desktop\MindSense_Colab_Upload
```

Upload these two folders from that package:

```text
MindSenseProject -> MyDrive/MindSenseProject
MindSenseData    -> MyDrive/MindSenseData
```

This compact package already contains cached audio/video tensors, so you do not need to upload the large raw `Audio` and `Video` CSV folders to Colab.

If you are not using the compact package, upload the raw DAIC-WOZ folders into:

```text
MyDrive/MindSenseData/Text
MyDrive/MindSenseData/Audio
MyDrive/MindSenseData/Video
```

Also upload these split/label files into `MyDrive/MindSenseData`:

```text
train_split.csv
dev_split.csv
test_split.csv
Detailed_PHQ8_Labels.csv
detailed_lables.csv
manifest.csv
```

If `manifest.csv` is not uploaded, the Colab runner can rebuild it.

## 2. Open the Colab runner

Open:

```text
ml/colab_mindsense_training.py
```

You can open it in Colab or copy the cells into a new Colab notebook.

Before running, set Colab runtime:

```text
Runtime -> Change runtime type -> GPU
```

## 3. Run Model A first

Run the setup cells, then run the cache/precompute cell. If you uploaded the compact package, it will detect the existing cache and skip raw preprocessing. If you uploaded raw CSVs, it creates:

```text
feature_cache_roberta/
manifest_cached_roberta.csv
feature_normalizers_roberta.json
```

This step may take time once, but it prevents training from reparsing large CSV files every epoch.

Then run Model A:

```text
RoBERTa + OpenSMILE/eGeMAPS+MFCC + OpenFace -> Gated Fusion -> PHQ
```

This is the defensible baseline.

## 4. Run Model B second

Run Model B:

```text
Same encoders -> Cross-modal Transformer Fusion -> PHQ
```

Compare `test_metrics.json` from both runs.

## 5. Optional Phase 2

Only if Model B finishes cleanly and you still have GPU time:

```text
Cross-modal fusion + unfreeze last 2 RoBERTa layers
```

This may improve accuracy but can overfit, so keep the checkpoint with the best dev MAE.

## 6. Files to bring back into the website project

After training, download/copy the best run folder:

```text
best_model.pt
config.json
feature_normalizers.json
test_metrics.json
```

Also keep:

```text
manifest_cached_roberta.csv
feature_cache_roberta/
```

Those cached files are useful if you want to continue training later.

Use `best_model.pt` with:

```bash
python ml/predict_api.py --checkpoint path/to/best_model.pt
```
