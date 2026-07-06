from __future__ import annotations

import math


SEVERITY_LABELS = ["Minimal", "Mild", "Moderate", "Moderately Severe", "Severe"]


def interpret_phq(score: float) -> str:
    if score < 5:
        return "Minimal"
    if score < 10:
        return "Mild"
    if score < 15:
        return "Moderate"
    if score < 20:
        return "Moderately Severe"
    return "Severe"


def severity_index(score: float) -> int:
    return SEVERITY_LABELS.index(interpret_phq(score))


def confidence_from_logits(logits, eps: float = 1e-8):
    probs = logits.softmax(dim=-1)
    entropy = -(probs * (probs + eps).log()).sum(dim=-1)
    max_entropy = math.log(logits.shape[-1])
    return (1.0 - entropy / max_entropy).clamp(0.0, 1.0)
