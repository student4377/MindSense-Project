from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer
import uvicorn

from dataset import ManifestRow, apply_normalizer, load_feature_normalizers, pad_sequence_batch, read_audio_sequence, read_video_sequence
from models import MultimodalPhqModel
from phq import SEVERITY_LABELS, confidence_from_logits, interpret_phq


DEFAULT_CHECKPOINT = Path(__file__).resolve().parent / "artifacts" / "mindsense_roberta_gated_tuned_v2" / "best_model.pt"


class PredictionRequest(BaseModel):
    user_id: str | None = None
    text_answers: list[dict[str, Any]] = []
    text_narrative: str = ""
    voice_path: str | None = None
    video_path: str | None = None
    audio_features_path: str | None = None
    audio_mfcc_path: str | None = None
    video_features_path: str | None = None
    audio_cache_path: str | None = None
    video_cache_path: str | None = None


def text_from_request(request: PredictionRequest) -> str:
    answer_text = " ".join(str(item.get("answer", "")) for item in request.text_answers)
    question_text = " ".join(str(item.get("question", "")) for item in request.text_answers)
    return " ".join([question_text, answer_text, request.text_narrative]).strip()


def resolve_normalizers(checkpoint_path: Path, checkpoint: dict[str, Any]) -> dict[str, Any] | None:
    if checkpoint.get("normalizers"):
        return checkpoint["normalizers"]

    sidecar_path = checkpoint_path.with_name("feature_normalizers_roberta.json")
    if sidecar_path.exists():
        return load_feature_normalizers(sidecar_path)

    return None


def build_app(checkpoint_path: str | Path, device_name: str = "auto") -> FastAPI:
    checkpoint_file = Path(checkpoint_path).expanduser().resolve()
    if not checkpoint_file.exists():
        raise FileNotFoundError(f"Model checkpoint not found: {checkpoint_file}")

    device = torch.device("cuda" if device_name == "auto" and torch.cuda.is_available() else "cpu" if device_name == "auto" else device_name)
    checkpoint = torch.load(checkpoint_file, map_location=device)
    config = checkpoint["config"]
    normalizers = resolve_normalizers(checkpoint_file, checkpoint)
    tokenizer = AutoTokenizer.from_pretrained(config["text_model"])
    model = MultimodalPhqModel(
        text_model_name=config["text_model"],
        audio_input_dim=config["audio_input_dim"],
        video_input_dim=config["video_input_dim"],
        fusion_dim=config["fusion_dim"],
        fusion_type=config.get("fusion_type", "gated"),
        dropout=config.get("dropout", 0.1),
        freeze_text=True,
    ).to(device)
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    app = FastAPI(title="MindSense Multimodal PHQ API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "model_version": "mindsense-roberta-gated-tuned-v2",
            "checkpoint": str(checkpoint_file),
            "device": str(device),
            "fusion_type": config.get("fusion_type", "gated"),
            "requires_features": True,
            "feature_contract": {
                "audio": "OpenSMILE eGeMAPS CSV plus optional MFCC CSV, or precomputed audio_cache_path .npy",
                "video": "OpenFace pose/gaze/AU CSV, or precomputed video_cache_path .npy",
            },
        }

    @app.post("/predict")
    def predict(request: PredictionRequest) -> dict[str, Any]:
        has_audio_features = bool(request.audio_features_path or request.audio_cache_path)
        has_video_features = bool(request.video_features_path or request.video_cache_path)
        if not has_audio_features or not has_video_features:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "FEATURE_EXTRACTION_REQUIRED",
                    "message": (
                        "The trained multimodal model is loaded, but it requires OpenSMILE audio features and "
                        "OpenFace video features. Browser .webm uploads must be converted to these feature files "
                        "before learned-model inference."
                    ),
                    "required_any_of": {
                        "audio": ["audio_features_path", "audio_cache_path"],
                        "video": ["video_features_path", "video_cache_path"],
                    },
                },
            )

        text = text_from_request(request)
        tokenized = tokenizer([text], padding=True, truncation=True, max_length=config["max_text_tokens"], return_tensors="pt")
        tokenized = {key: value.to(device) for key, value in tokenized.items()}
        row = ManifestRow(
            participant_id=request.user_id or "inference",
            split="inference",
            phq_score=0.0,
            transcript_path="",
            audio_features_path=request.audio_features_path or "",
            video_features_path=request.video_features_path or "",
            audio_mfcc_path=request.audio_mfcc_path or "",
            audio_cache_path=request.audio_cache_path or "",
            video_cache_path=request.video_cache_path or "",
        )
        audio_values = read_audio_sequence(row, config["max_audio_frames"], use_mfcc=bool(config.get("use_mfcc", False)))
        video_values = read_video_sequence(row, config["max_video_frames"])
        audio = torch.from_numpy(apply_normalizer(audio_values, normalizers.get("audio") if normalizers else None))
        video = torch.from_numpy(apply_normalizer(video_values, normalizers.get("video") if normalizers else None))
        audio_batch, audio_mask = pad_sequence_batch([audio])
        video_batch, video_mask = pad_sequence_batch([video])
        audio_batch = audio_batch.to(device)
        audio_mask = audio_mask.to(device)
        video_batch = video_batch.to(device)
        video_mask = video_mask.to(device)

        with torch.no_grad():
            outputs = model(
                {
                    "text": tokenized,
                    "audio": audio_batch,
                    "audio_mask": audio_mask,
                    "video": video_batch,
                    "video_mask": video_mask,
                }
            )
        phq_score = float(outputs["phq"].item())
        severity = interpret_phq(phq_score)
        confidence = float(confidence_from_logits(outputs["severity_logits"]).item())
        logits = outputs["severity_logits"].softmax(dim=-1).squeeze(0)

        return {
            "phq_score": phq_score,
            "depression_severity": severity,
            "confidence": confidence,
            "model_version": "mindsense-roberta-gated-tuned-v2",
            "explanation": f"Predicted PHQ-8 {phq_score:.1f}/24 ({severity}) using learned {config.get('fusion_type', 'gated')} multimodal fusion.",
            "modality_gates": {name: float(value.item()) for name, value in outputs["gates"].items()},
            "severity_distribution": {label: float(logits[index].item()) for index, label in enumerate(SEVERITY_LABELS)},
        }

    return app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", default=str(DEFAULT_CHECKPOINT))
    parser.add_argument("--device", default="auto", help="Use auto, cpu, cuda, or a torch device string.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    api = build_app(args.checkpoint, args.device)
    uvicorn.run(api, host=args.host, port=args.port)
