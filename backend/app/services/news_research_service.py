import os
import requests

SERPAPI_KEY = os.getenv("SERPAPI_KEY")
SERPAPI_URL = "https://serpapi.com/search"


def fetch_google_news_light(query: str, num_results: int = 10) -> list[dict]:
    """
    Fetch lightweight news results for a query using SerpAPI's Google News engine.
    Returns a list of dicts: {title, snippet, link, source, date, thumbnail}
    """
    if not SERPAPI_KEY:
        raise RuntimeError("SERPAPI_KEY is not set in environment")

    params = {
        "engine": "google_news",
        "q": query,
        "api_key": SERPAPI_KEY,
    }

    response = requests.get(SERPAPI_URL, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()

    news_results = data.get("news_results", [])[:num_results]

    results = []
    for item in news_results:
        results.append({
            "title": item.get("title"),
            "snippet": item.get("snippet"),
            "link": item.get("link"),
            "source": item.get("source", {}).get("name") if isinstance(item.get("source"), dict) else item.get("source"),
            "date": item.get("date"),
            "thumbnail": item.get("thumbnail"),
        })

    return results