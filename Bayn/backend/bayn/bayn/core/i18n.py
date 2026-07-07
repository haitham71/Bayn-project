"""
i18n engine — loads per-feature translations and resolves them by locale.

Locale comes from the Accept-Language header via get_locale().
Translations live in each feature's locales/{ar,en}.json.
"""

import json
from functools import lru_cache
from pathlib import Path

from fastapi import Header


SUPPORTED_LOCALES = {"ar", "en"}
DEFAULT_LOCALE = "en"

BAYN_DIR = Path(__file__).parent.parent


@lru_cache(maxsize=None)
def _load_locale(feature_name: str, locale: str) -> dict:
    # cached so each JSON file is read from disk only once
    locale_file = BAYN_DIR / "features" / feature_name / "locales" / f"{locale}.json"

    if not locale_file.exists():
        return {}

    with open(locale_file, encoding="utf-8") as f:
        return json.load(f)


def t(feature_name: str, key: str, locale: str = DEFAULT_LOCALE) -> str:
    if locale not in SUPPORTED_LOCALES:
        locale = DEFAULT_LOCALE

    translations = _load_locale(feature_name, locale)
    value = _get_nested(translations, key)

    # fall back to English before giving up
    if value is None and locale != DEFAULT_LOCALE:
        value = _get_nested(_load_locale(feature_name, DEFAULT_LOCALE), key)

    # return the key itself if no translation exists — makes gaps visible
    return value if value is not None else key


def _get_nested(data: dict, key: str) -> str | None:
    # walk dot-notation keys: "auth.invalid_credentials" → data["auth"]["invalid_credentials"]
    keys = key.split(".")
    current = data

    for k in keys:
        if not isinstance(current, dict) or k not in current:
            return None
        current = current[k]

    return current if isinstance(current, str) else None


def get_locale(
    accept_language: str = Header(default="en", alias="Accept-Language"),
) -> str:
    if not accept_language:
        return DEFAULT_LOCALE

    # "ar-SA,en;q=0.9" → take the first tag, strip region → "ar"
    primary = accept_language.split(",")[0].strip()
    lang_code = primary.split("-")[0].strip().lower()

    return lang_code if lang_code in SUPPORTED_LOCALES else DEFAULT_LOCALE
