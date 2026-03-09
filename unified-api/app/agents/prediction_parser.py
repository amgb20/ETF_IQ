"""Extract structured predictions from agent response text."""

from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

PREDICTION_KEYS = {"prediction", "confidence", "timeframe"}


def parse(text: str) -> list[dict]:
    """Extract prediction objects from agent text.

    Tries to find a JSON array of predictions first (```json ... ```),
    then falls back to individual JSON objects, then regex extraction.
    """
    predictions = _try_json_array(text)
    if predictions:
        return predictions

    predictions = _try_json_objects(text)
    if predictions:
        return predictions

    return _try_regex(text)


def _try_json_array(text: str) -> list[dict]:
    """Look for a JSON array in fenced code blocks or inline."""
    patterns = [
        r"```(?:json)?\s*(\[[\s\S]*?\])\s*```",
        r"(\[\s*\{[\s\S]*?\}\s*\])",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text):
            try:
                data = json.loads(match.group(1))
                if isinstance(data, list):
                    valid = [_normalize(item) for item in data if _is_valid(item)]
                    if valid:
                        return valid
            except json.JSONDecodeError:
                continue
    return []


def _try_json_objects(text: str) -> list[dict]:
    """Look for individual JSON objects containing prediction fields."""
    results = []
    for match in re.finditer(r"\{[^{}]*\"prediction\"[^{}]*\}", text):
        try:
            obj = json.loads(match.group())
            if _is_valid(obj):
                results.append(_normalize(obj))
        except json.JSONDecodeError:
            continue
    return results


def _try_regex(text: str) -> list[dict]:
    """Last-resort: extract prediction-like patterns from text."""
    results = []
    blocks = re.split(r"\n(?=Prediction\b)", text, flags=re.IGNORECASE)
    for block in blocks:
        pred_match = re.search(r"Prediction:\s*(.+?)(?:\n|$)", block, re.IGNORECASE)
        conf_match = re.search(r"Confidence:\s*(\d+)", block, re.IGNORECASE)
        time_match = re.search(r"Timeframe:\s*(.+?)(?:\n|$)", block, re.IGNORECASE)
        if pred_match:
            results.append({
                "prediction": pred_match.group(1).strip(),
                "confidence": int(conf_match.group(1)) if conf_match else 5,
                "timeframe": time_match.group(1).strip() if time_match else "1 week",
            })
    return results


def _is_valid(obj: dict) -> bool:
    return isinstance(obj, dict) and "prediction" in obj


def _normalize(obj: dict) -> dict:
    return {
        "prediction": str(obj.get("prediction", "")),
        "confidence": int(obj.get("confidence", 5)),
        "timeframe": str(obj.get("timeframe", "1 week")),
    }
