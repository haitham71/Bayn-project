"""Shared display-formatting helpers."""


def format_badge_count(count: int) -> str:
    """Unread-count badge text: the exact number up to 9, "9+" past that."""
    return str(count) if count <= 9 else "9+"
