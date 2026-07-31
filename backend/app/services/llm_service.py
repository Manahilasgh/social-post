import os
import json
import requests

OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")


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
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()

    raw_text = data["choices"][0]["message"]["content"].strip()
    # strip stray markdown fences if the model adds them anyway
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