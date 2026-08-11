import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { handleApiError, HttpError } from "@/lib/api-error-handler";
import { fetchGoogleNewsLight } from "@/lib/news-research-service";
import { generatePostCopy } from "@/lib/llm-service";
import {
  getPlatformConfig,
  PLATFORM_CONFIG,
  DEFAULT_PLATFORM,
} from "@/lib/platform-config";

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);

    // Parse request body
    const body = await request.json();
    const { query, platform: requestedPlatform } = body;

    // Validate query
    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { detail: "Query is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Validate and default platform
    const platform =
      requestedPlatform &&
      requestedPlatform in PLATFORM_CONFIG
        ? requestedPlatform
        : DEFAULT_PLATFORM;

    // Fetch news results
    let newsResults;
    try {
      newsResults = await fetchGoogleNewsLight(query.trim());
    } catch (error) {
      console.error("News fetch error:", error);
      throw new HttpError(
        `Failed to fetch news results: ${error instanceof Error ? error.message : "Unknown error"}`,
        502
      );
    }

    // Check if we got any results
    if (!newsResults || newsResults.length === 0) {
      return NextResponse.json(
        { detail: "No news results found for the given query" },
        { status: 422 }
      );
    }

    // Generate post copy
    let generatedCopy;
    try {
      generatedCopy = await generatePostCopy(query.trim(), newsResults, platform);
    } catch (error) {
      console.error("LLM generation error:", error);
      throw new HttpError(
        `Failed to generate post copy: ${error instanceof Error ? error.message : "Unknown error"}`,
        502
      );
    }

    // Get platform configuration
    const platformConfig = getPlatformConfig(platform);

    // Build response
    return NextResponse.json({
      headline: generatedCopy.headline,
      description: generatedCopy.description,
      story_description: generatedCopy.story_description,
      hashtags: generatedCopy.hashtags,
      news_results: newsResults,
      platform,
      aspect_ratio: platformConfig.aspect_ratio,
      card_width: platformConfig.width,
      card_height: platformConfig.height,
      description_max_chars: platformConfig.description_max_chars,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
