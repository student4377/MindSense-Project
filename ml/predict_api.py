from __future__ import annotations

import argparse
import json
from tempfile import TemporaryDirectory
from pathlib import Path
from typing import Any

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer
import uvicorn

from dataset import ManifestRow, apply_normalizer, load_feature_normalizers, pad_sequence_batch, read_audio_sequence, read_video_sequence
from media_features import (
    FeatureExtractionError,
    extract_audio_features,
    extract_video_features,
    fetch_media_source,
    media_tool_status,
)
from models import MultimodalPhqModel
from phq import SEVERITY_LABELS, confidence_from_logits, interpret_phq


DEFAULT_CHECKPOINT = Path(__file__).resolve().parent / "artifacts" / "mindsense_roberta_gated_tuned_v2" / "best_model.pt"


class PredictionRequest(BaseModel):
    user_id: str | None = None
    text_answers: list[dict[str, Any]] = []
    text_narrative: str = ""
    voice_path: str | None = None
    video_path: str | None = None
    voice_url: str | None = None
    video_url: str | None = None
    audio_features_path: str | None = None
    audio_mfcc_path: str | None = None
    video_features_path: str | None = None
    audio_cache_path: str | None = None
    video_cache_path: str | None = None


def text_from_request(request: PredictionRequest) -> str:
    answer_text = " ".join(str(item.get("answer", "")) for item in request.text_answers)
    question_text = " ".join(str(item.get("question", "")) for item in request.text_answers)
    return " ".join([question_text, answer_text, request.text_narrative]).strip()


def audio_transcript_from_extraction(extraction_info: dict[str, Any] | None) -> dict[str, Any] | None:
    if not extraction_info:
        return None
    audio_info = extraction_info.get("audio")
    if not isinstance(audio_info, dict):
        return None
    transcript = audio_info.get("transcript")
    return transcript if isinstance(transcript, dict) else None


def text_context_from_request(request: PredictionRequest, extraction_info: dict[str, Any] | None = None) -> str:
    base_text = text_from_request(request)
    transcript = audio_transcript_from_extraction(extraction_info)
    transcript_text = str(transcript.get("text", "")).strip() if transcript else ""
    if not transcript_text:
        return base_text
    transcript_label = "Audio transcript translated to English" if transcript.get("task") == "translate" else "Audio speech transcript"
    return f"{base_text} {transcript_label}: {transcript_text}".strip()


def observations_from_prediction(
    phq_score: float,
    severity: str,
    fusion_type: str,
    extraction_info: dict[str, Any] | None,
) -> list[str]:
    observations = [
        f"Predicted PHQ-8 {phq_score:.1f}/24 ({severity}) using learned {fusion_type} multimodal fusion.",
    ]
    transcript = audio_transcript_from_extraction(extraction_info)
    if transcript:
        if transcript.get("text"):
            task_label = "translated" if transcript.get("task") == "translate" else "transcribed"
            language = transcript.get("language") or "auto-detected"
            observations.append(f"Audio speech was {task_label} to English from {language} and included in the text context.")
        elif transcript.get("enabled") and not transcript.get("available"):
            observations.append("Audio transcript was requested but unavailable, so acoustic audio features were used without speech text.")
    return observations


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
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?",
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
            "media_feature_tools": media_tool_status(),
            "feature_contract": {
                "audio": "OpenSMILE eGeMAPS CSV plus optional MFCC CSV, or precomputed audio_cache_path .npy",
                "video": "OpenFace pose/gaze/AU CSV, or precomputed video_cache_path .npy",
            },
        }

    def predict_from_arrays(request: PredictionRequest, audio_values: Any, video_values: Any, extraction_info: dict[str, Any] | None = None) -> dict[str, Any]:
        text = text_context_from_request(request, extraction_info)
        tokenized = tokenizer([text], padding=True, truncation=True, max_length=config["max_text_tokens"], return_tensors="pt")
        tokenized = {key: value.to(device) for key, value in tokenized.items()}
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
        fusion_type = config.get("fusion_type", "gated")
        observations = observations_from_prediction(phq_score, severity, fusion_type, extraction_info)

        return {
            "phq_score": phq_score,
            "depression_severity": severity,
            "confidence": confidence,
            "model_version": "mindsense-roberta-gated-tuned-v2",
            "explanation": observations[0],
            "observations": observations,
            "modality_gates": {name: float(value.item()) for name, value in outputs["gates"].items()},
            "severity_distribution": {label: float(logits[index].item()) for index, label in enumerate(SEVERITY_LABELS)},
            "feature_extraction": extraction_info,
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
        return predict_from_arrays(request, audio_values, video_values)

    @app.post("/predict-from-media")
    def predict_from_media(request: PredictionRequest) -> dict[str, Any]:
        try:
            with TemporaryDirectory(prefix="mindsense-media-") as temp_dir:
                work_dir = Path(temp_dir)
                audio_source = fetch_media_source(request.voice_url or request.voice_path, work_dir, "voice_input.webm")
                video_source = fetch_media_source(request.video_url or request.video_path, work_dir, "video_input.webm")
                audio_values, audio_info = extract_audio_features(
                    audio_source,
                    work_dir,
                    max_frames=config["max_audio_frames"],
                    use_mfcc=bool(config.get("use_mfcc", False)),
                )
                video_values, video_info = extract_video_features(video_source, work_dir, max_frames=config["max_video_frames"])
                if audio_values.shape[1] != config["audio_input_dim"]:
                    raise FeatureExtractionError(
                        f"Audio feature dimension mismatch: expected {config['audio_input_dim']}, got {audio_values.shape[1]}."
                    )
                if video_values.shape[1] != config["video_input_dim"]:
                    raise FeatureExtractionError(
                        f"Video feature dimension mismatch: expected {config['video_input_dim']}, got {video_values.shape[1]}."
                    )
                return predict_from_arrays(
                    request,
                    audio_values,
                    video_values,
                    extraction_info={
                        "audio": audio_info,
                        "video": video_info,
                        "tools": media_tool_status(),
                    },
                )
        except FeatureExtractionError as exc:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "MEDIA_FEATURE_EXTRACTION_FAILED",
                    "message": str(exc),
                    "tools": media_tool_status(),
                },
            ) from exc

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
