"""
Central config for per-platform constraints. Both the LLM prompt (character
limits) and the card export (aspect ratio) read from this single source,
so adding a new platform later means updating one place, not several.
"""

PLATFORM_CONFIG = {
    "facebook": {
        "description_max_chars": 500,      # practical limit before "See more" truncation
        "aspect_ratio": "4:5",              # 1080x1350 — feed portrait
        "width": 1080,
        "height": 1350,
    },
    "x": {
        "description_max_chars": 280,
        "aspect_ratio": "16:9",
        "width": 1200,
        "height": 675,
    },
    "instagram": {
        "description_max_chars": 2200,
        "aspect_ratio": "4:5",
        "width": 1080,
        "height": 1350,
    },
    "linkedin": {
        "description_max_chars": 700,       # practical limit before truncation in feed
        "aspect_ratio": "1.91:1",
        "width": 1200,
        "height": 628,
    },
    "pinterest": {
        "description_max_chars": 500,
        "aspect_ratio": "2:3",
        "width": 1000,
        "height": 1500,
    },
}

DEFAULT_PLATFORM = "facebook"


def get_platform_config(platform: str) -> dict:
    return PLATFORM_CONFIG.get(platform, PLATFORM_CONFIG[DEFAULT_PLATFORM])