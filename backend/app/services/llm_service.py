import os
import json
import requests

OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
# nvidia/nemotron-3-ultra-550b-a55b:free runs on NVIDIA's own infra and is far
# less susceptible to Google AI Studio's shared-pool rate limits.
MODEL = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free")


def generate_post_copy(query: str, news_results: list[dict]) -> dict:
    """
    Given a topic and fetched news results, ask the LLM to produce:
    headline, description, story_description, hashtags (list[str])
    Returns a dict with those keys.
    """
    if not OPENROUTER_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not set in environment")

    context_snippets = "\n".join(
        f"- {item['title']}: {item.get('snippet', '')}" for item in news_results[:5]
    )

    system_prompt = (
        "You are a social media copywriter. Given a topic and recent news snippets, "
        "produce social post copy. Respond ONLY with a JSON object, no markdown fences, "
        "no preamble, in exactly this shape:\n"
        '{"headline": "...", "description": "...", "story_description": "...", "hashtags": ["...", "..."]}\n'
        "headline: short, punchy, under 12 words.\n"
        "description: 1-2 sentence summary for feed captions.\n"
        "story_description: slightly longer, 2-3 sentences, for story/card format.\n"
        "hashtags: 5-8 relevant hashtags, no # symbol included, just the words."
    )

    user_prompt = f"Topic: {query}\n\nRecent news:\n{context_snippets}"

    response = requests.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {OPENROUTER_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=60,
    )

    print(f"[LLM] Model: {MODEL}")
    print(f"[LLM] Status: {response.status_code}")

    # Surface provider errors with a clean message before raise_for_status crashes
    if not response.ok:
        body = ""
        try:
            err = response.json()
            body = err.get("error", {}).get("message", response.text[:300])
        except Exception:
            body = response.text[:300]
        print(f"[LLM] Error body: {body}")

        if response.status_code == 429:
            raise RuntimeError(
                f"Model '{MODEL}' is rate-limited. "
                "Try again in a moment, or set a different OPENROUTER_MODEL in .env."
            )
        if response.status_code == 404:
            raise RuntimeError(
                f"Model '{MODEL}' not found or no longer available. "
                "Update OPENROUTER_MODEL in .env."
            )

        raise RuntimeError(f"OpenRouter returned {response.status_code}: {body}")

    data = response.json()
    print(f"[LLM] Response keys: {list(data.keys())}")
    print(f"[LLM] Full response: {json.dumps(data)[:500]}")

    # Some models wrap the response differently — handle both standard and non-standard shapes
    if "choices" not in data:
        # OpenRouter sometimes returns a 200 with an error object inside
        if "error" in data:
            err_msg = data["error"].get("message", str(data["error"]))
            raise RuntimeError(f"Model returned an error: {err_msg}")
        raise RuntimeError(f"Unexpected response shape from model. Keys: {list(data.keys())}. Body: {json.dumps(data)[:300]}")

    raw_text = data["choices"][0]["message"]["content"].strip()
    print(f"[LLM] Raw response: {raw_text[:300]}")

    # Strip stray markdown fences if the model adds them anyway
    cleaned = raw_text.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"LLM did not return valid JSON: {cleaned[:200]}") from e

    return {
        "headline": parsed.get("headline", ""),
        "description": parsed.get("description", ""),
        "story_description": parsed.get("story_description", ""),
        "hashtags": parsed.get("hashtags", []),
    }
