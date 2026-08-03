import os
import requests

SERPAPI_KEY = os.getenv("SERPAPI_KEY")
SERPAPI_URL = "https://serpapi.com/search"


def search_background_images(query: str, num_results: int = 12) -> list[dict]:
    """
    Searches Google Images via SerpAPI for background image candidates.
    Returns a list of dicts: {thumbnail, original, title, source}
    """
    if not SERPAPI_KEY:
        raise RuntimeError("SERPAPI_KEY is not set in environment")

    params = {
        "engine": "google_images",
        "q": query,
        "api_key": SERPAPI_KEY,
        "num": num_results,
    }

    response = requests.get(SERPAPI_URL, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()

    images = data.get("images_results", [])[:num_results]

    results = []
    for img in images:
        results.append({
            "thumbnail": img.get("thumbnail"),
            "original": img.get("original"),
            "title": img.get("title"),
            "source": img.get("source"),
        })

    return results