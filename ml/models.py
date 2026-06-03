from __future__ import annotations

import torch
from torch import nn
from transformers import AutoModel


class TextEncoder(nn.Module):
    def __init__(self, model_name: str, output_dim: int, freeze: bool = True) -> None:
        super().__init__()
        self.transformer = AutoModel.from_pretrained(model_name)
        hidden_size = self.transformer.config.hidden_size
        self.projection = nn.Sequential(nn.Linear(hidden_size, output_dim), nn.LayerNorm(output_dim), nn.GELU())
        if freeze:
            for param in self.transformer.parameters():
                param.requires_grad = False

    def forward(self, tokenized: dict[str, torch.Tensor]) -> torch.Tensor:
        outputs = self.transformer(**tokenized)
        pooled = outputs.last_hidden_state[:, 0]
        return self.projection(pooled)


class AudioEncoder(nn.Module):
    def __init__(self, input_dim: int, output_dim: int) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv1d(input_dim, 128, kernel_size=5, padding=2),
            nn.BatchNorm1d(128),
            nn.GELU(),
            nn.Conv1d(128, 256, kernel_size=5, padding=2),
            nn.BatchNorm1d(256),
            nn.GELU(),
            nn.AdaptiveAvgPool1d(1),
        )
        self.projection = nn.Sequential(nn.Flatten(), nn.Linear(256, output_dim), nn.LayerNorm(output_dim), nn.GELU())

    def forward(self, sequence: torch.Tensor, mask: torch.Tensor | None = None) -> torch.Tensor:
        x = sequence.transpose(1, 2)
        return self.projection(self.net(x))


class VideoEncoder(nn.Module):
    def __init__(self, input_dim: int, output_dim: int, layers: int = 2, heads: int = 4) -> None:
        super().__init__()
        self.input_projection = nn.Linear(input_dim, output_dim)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=output_dim,
            nhead=heads,
            dim_feedforward=output_dim * 4,
            dropout=0.1,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=layers)
        self.norm = nn.LayerNorm(output_dim)

    def forward(self, sequence: torch.Tensor, mask: torch.Tensor | None = None) -> torch.Tensor:
        x = self.input_projection(sequence)
        x = self.encoder(x, src_key_padding_mask=mask)
        if mask is None:
            pooled = x.mean(dim=1)
        else:
            valid = (~mask).float().unsqueeze(-1)
            pooled = (x * valid).sum(dim=1) / valid.sum(dim=1).clamp_min(1.0)
        return self.norm(pooled)


class GatedFusion(nn.Module):
    def __init__(self, dim: int) -> None:
        super().__init__()
        self.text_gate = nn.Linear(dim, dim)
        self.audio_gate = nn.Linear(dim, dim)
        self.video_gate = nn.Linear(dim, dim)
        self.norm = nn.LayerNorm(dim)

    def forward(self, text: torch.Tensor, audio: torch.Tensor, video: torch.Tensor) -> tuple[torch.Tensor, dict[str, torch.Tensor]]:
        g_text = torch.sigmoid(self.text_gate(text))
        g_audio = torch.sigmoid(self.audio_gate(audio))
        g_video = torch.sigmoid(self.video_gate(video))
        fused = self.norm(g_text * text + g_audio * audio + g_video * video)
        gates = {
            "text": g_text.mean(dim=-1),
            "audio": g_audio.mean(dim=-1),
            "video": g_video.mean(dim=-1),
        }
        return fused, gates


class MultimodalPhqModel(nn.Module):
    def __init__(
        self,
        text_model_name: str,
        audio_input_dim: int,
        video_input_dim: int,
        fusion_dim: int = 256,
        freeze_text: bool = True,
    ) -> None:
        super().__init__()
        self.text_encoder = TextEncoder(text_model_name, fusion_dim, freeze=freeze_text)
        self.audio_encoder = AudioEncoder(audio_input_dim, fusion_dim)
        self.video_encoder = VideoEncoder(video_input_dim, fusion_dim)
        self.fusion = GatedFusion(fusion_dim)
        self.regression_head = nn.Sequential(nn.Linear(fusion_dim, fusion_dim // 2), nn.GELU(), nn.Linear(fusion_dim // 2, 1))
        self.classification_head = nn.Sequential(nn.Linear(fusion_dim, fusion_dim // 2), nn.GELU(), nn.Linear(fusion_dim // 2, 5))

    def forward(self, batch: dict[str, torch.Tensor]) -> dict[str, torch.Tensor]:
        text = self.text_encoder(batch["text"])
        audio = self.audio_encoder(batch["audio"], batch.get("audio_mask"))
        video = self.video_encoder(batch["video"], batch.get("video_mask"))
        fused, gates = self.fusion(text, audio, video)
        phq = self.regression_head(fused).squeeze(-1).clamp(0, 24)
        severity_logits = self.classification_head(fused)
        return {
            "phq": phq,
            "severity_logits": severity_logits,
            "gates": gates,
        }
