from __future__ import annotations

import math


SEVERITY_LABELS = ["Minimal", "Mild", "Moderate", "Moderately Severe", "Severe"]


def interpret_phq(score: float) -> str:
    if 0 <= score <= 4:
        return "Minimal"
    if 5 <= score <= 9:
        return "Mild"
    if 10 <= score <= 14:
        return "Moderate"
    if 15 <= score <= 19:
        return "Moderately Severe"
    return "Severe"


def severity_index(score: float) -> int:
    return SEVERITY_LABELS.index(interpret_phq(score))


def confidence_from_logits(logits, eps: float = 1e-8):
    probs = logits.softmax(dim=-1)
    entropy = -(probs * (probs + eps).log()).sum(dim=-1)
    max_entropy = math.log(logits.shape[-1])
    return (1.0 - entropy / max_entropy).clamp(0.0, 1.0)
