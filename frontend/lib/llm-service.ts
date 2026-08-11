import { getPlatformConfig } from "./platform-config";

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export interface GeneratedCopy {
  headline: string;
  description: string;
  story_description: string;
  hashtags: string[];
}

/**
 * Generate social media post copy using OpenRouter LLM
 * @param query The user's search query
 * @param newsResults Array of news results from fetchGoogleNewsLight
 * @param platform Target platform (default: "facebook")
 * @returns Generated post copy
 * @throws Error if API key missing, API call fails, or response invalid
 */
export async function generatePostCopy(
  query: string,
  newsResults: any[],
  platform = "facebook"
): Promise<GeneratedCopy> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "openrouter/free";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  const platformConfig = getPlatformConfig(platform);
  const maxChars = platformConfig.description_max_chars;

  // Build system prompt
  const systemPrompt = `You are a social media content generator. Given a query and news context, generate engaging post copy for ${platform}.

Return ONLY valid JSON with this exact structure:
{
  "headline": "string (under 12 words, attention-grabbing)",
  "description": "string (under ${maxChars} characters, engaging post text)",
  "story_description": "string (2-3 sentences summarizing the story)",
  "hashtags": ["word1", "word2", "word3", "word4", "word5"] (5-8 single words without # symbols)
}

Requirements:
- headline: Maximum 12 words, capitalize key words
- description: Maximum ${maxChars} characters for ${platform}
- story_description: 2-3 complete sentences
- hashtags: 5-8 single words without # symbols, relevant to the topic`;

  // Build user prompt with news context
  const newsContext =
    newsResults.length > 0
      ? newsResults
          .slice(0, 3)
          .map((n) => `- ${n.title} (${n.source})`)
          .join("\n")
      : "No news results available";

  const userPrompt = `Query: ${query}

Recent news:
${newsContext}

Generate engaging social media post copy in JSON format.`;

  // Call OpenRouter API
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Social Post Generator",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenRouter API request failed: ${response.status} ${response.statusText}`
    );
  }

  const data: OpenRouterResponse = await response.json();

  if (!data.choices || !data.choices[0]?.message?.content) {
    throw new Error("OpenRouter API returned no content");
  }

  let content = data.choices[0].message.content.trim();

  // Strip markdown code fences if present
  if (content.startsWith("```json")) {
    content = content.replace(/^```json\s*/, "").replace(/```\s*$/, "");
  } else if (content.startsWith("```")) {
    content = content.replace(/^```\s*/, "").replace(/```\s*$/, "");
  }

  // Parse JSON response
  let parsed: GeneratedCopy;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse LLM response as JSON: ${content.substring(0, 100)}`);
  }

  // Validate response structure
  if (
    !parsed.headline ||
    !parsed.description ||
    !parsed.story_description ||
    !Array.isArray(parsed.hashtags)
  ) {
    throw new Error(
      "Invalid LLM response structure: missing required fields (headline, description, story_description, hashtags)"
    );
  }

  // Safety net: hard-truncate description if LLM overshot
  if (parsed.description.length > maxChars) {
    parsed.description = parsed.description.substring(0, maxChars - 1) + "…";
  }

  return parsed;
}
