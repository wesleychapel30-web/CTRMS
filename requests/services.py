from __future__ import annotations

import re

from .models import Request


def suggest_request_category(text: str) -> str:
    """
    Lightweight (non-ML) category suggestion to keep deployments self-contained.

    This is intentionally deterministic and explainable. It can be replaced by a true AI
    classifier later without changing API contracts.
    """

    hay = (text or "").strip().lower()
    hay = re.sub(r"\s+", " ", hay)

    tuition_keywords = ["tuition", "school", "fees", "university", "college", "semester", "exam"]
    medical_keywords = ["medical", "hospital", "surgery", "treatment", "clinic", "medicine", "doctor"]
    construction_keywords = ["construction", "build", "building", "renovation", "roof", "cement", "materials"]
    sponsorship_keywords = ["event", "sponsorship", "sponsor", "conference", "seminar", "workshop", "ceremony", "fundraiser"]

    if any(k in hay for k in tuition_keywords):
        return Request.Category.TUITION
    if any(k in hay for k in medical_keywords):
        return Request.Category.MEDICAL
    if any(k in hay for k in construction_keywords):
        return Request.Category.CONSTRUCTION
    if any(k in hay for k in sponsorship_keywords):
        return Request.Category.EVENT_SPONSORSHIP
    return Request.Category.OTHER
