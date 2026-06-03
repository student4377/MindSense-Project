from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer
import uvicorn

from dataset import pad_sequence_batch, read_feature_sequence
from models import MultimodalPhqModel
from phq import SEVERITY_LABELS, confidence_from_logits, interpret_phq


class PredictionRequest(BaseModel):
    user_id: str | None = None
    text_answers: list[dict[str, Any]] = []
    text_narrative: str = ""
    voice_path: str | None = None
    video_path: str | None = None
    audio_features_path: str | None = None
    video_features_path: str | None = None


def text_from_request(request: PredictionRequest) -> str:
    answer_text = " ".join(str(item.get("answer", "")) for item in request.text_answers)
    question_text = " ".join(str(item.get("question", "")) for item in request.text_answers)
    return " ".join([question_text, answer_text, request.text_narrative]).strip()


def build_app(checkpoint_path: str | Path) -> FastAPI:
    checkpoint = torch.load(checkpoint_path, map_location="cpu")
    config = checkpoint["config"]
    tokenizer = AutoTokenizer.from_pretrained(config["text_model"])
    model = MultimodalPhqModel(
        text_model_name=config["text_model"],
        audio_input_dim=config["audio_input_dim"],
        video_input_dim=config["video_input_dim"],
        fusion_dim=config["fusion_dim"],
        freeze_text=True,
    )
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    app = FastAPI(title="MindSense Multimodal PHQ API")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "model_version": "mindsense-mm-v1"}

    @app.post("/predict")
    def predict(request: PredictionRequest) -> dict[str, Any]:
        if not request.audio_features_path or not request.video_features_path:
            raise HTTPException(
                status_code=422,
                detail=(
                    "audio_features_path and video_features_path are required by this scaffold. "
                    "Production should extract OpenSMILE/OpenFace features from voice_path/video_path before inference."
                ),
            )

        text = text_from_request(request)
        tokenized = tokenizer([text], padding=True, truncation=True, max_length=config["max_text_tokens"], return_tensors="pt")
        audio = torch.from_numpy(read_feature_sequence(request.audio_features_path, config["max_audio_frames"]))
        video = torch.from_numpy(read_feature_sequence(request.video_features_path, config["max_video_frames"]))
        audio_batch, audio_mask = pad_sequence_batch([audio])
        video_batch, video_mask = pad_sequence_batch([video])

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
            "model_version": "mindsense-mm-v1",
            "explanation": f"Predicted PHQ-8 {phq_score:.1f}/24 ({severity}) using learned gated multimodal fusion.",
            "modality_gates": {name: float(value.item()) for name, value in outputs["gates"].items()},
            "severity_distribution": {label: float(logits[index].item()) for index, label in enumerate(SEVERITY_LABELS)},
        }

    return app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    api = build_app(args.checkpoint)
    uvicorn.run(api, host=args.host, port=args.port)
