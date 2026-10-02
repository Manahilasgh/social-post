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

interface PlatformVariant {
  description: string;
  aspect_ratio: string;
  width: number;
  height: number;
  description_max_chars: number;
}

interface MultiPlatformResponse {
  headline: string;
  story_description: string;
  hashtags: string[];
  news_results: any[];
  variants: Record<string, PlatformVariant>;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);

    // Parse request body
    const body = await request.json();
    const { query, platforms: requestedPlatforms, platform: singlePlatform } = body;

    // Validate query
    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { detail: "Query is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Handle platforms parameter - support both new array format and legacy single platform
    let platforms: string[] = [];
    
    if (requestedPlatforms && Array.isArray(requestedPlatforms)) {
      // New multi-platform format
      platforms = requestedPlatforms;
    } else if (singlePlatform && typeof singlePlatform === "string") {
      // Legacy single platform format
      platforms = [singlePlatform];
    } else {
      // Default fallback
      platforms = [DEFAULT_PLATFORM];
    }

    // Validate and filter platforms against available configs
    const validPlatforms = platforms.filter(p => p in PLATFORM_CONFIG);
    
    // If no valid platforms, use default
    if (validPlatforms.length === 0) {
      validPlatforms.push(DEFAULT_PLATFORM);
    }

    // Fetch news results once (shared across all platforms)
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

    // Generate post copy for each platform in parallel
    let generatedCopies;
    try {
      generatedCopies = await Promise.all(
        validPlatforms.map(platform => generatePostCopy(query.trim(), newsResults, platform))
      );
    } catch (error) {
      console.error("LLM generation error:", error);
      throw new HttpError(
        `Failed to generate post copy: ${error instanceof Error ? error.message : "Unknown error"}`,
        502
      );
    }

    // Use the first platform's results for shared content (headline, story_description, hashtags)
    const primaryGenerated = generatedCopies[0];
    
    // Build variants object with platform-specific descriptions and configs
    const variants: Record<string, PlatformVariant> = {};
    
    validPlatforms.forEach((platform, index) => {
      const platformConfig = getPlatformConfig(platform);
      const generated = generatedCopies[index];
      
      variants[platform] = {
        description: generated.description,
        aspect_ratio: platformConfig.aspect_ratio,
        width: platformConfig.width,
        height: platformConfig.height,
        description_max_chars: platformConfig.description_max_chars,
      };
    });

    // Build response with new multi-platform format
    const response: MultiPlatformResponse = {
      headline: primaryGenerated.headline,
      story_description: primaryGenerated.story_description,
      hashtags: primaryGenerated.hashtags,
      news_results: newsResults,
      variants,
    };

    // Backward compatibility: if only one platform was requested (legacy mode),
    // return the old format for existing frontend code
    if (validPlatforms.length === 1 && !Array.isArray(requestedPlatforms)) {
      const platform = validPlatforms[0];
      const variant = variants[platform];
      
      return NextResponse.json({
        headline: response.headline,
        description: variant.description,
        story_description: response.story_description,
        hashtags: response.hashtags,
        news_results: response.news_results,
        platform,
        aspect_ratio: variant.aspect_ratio,
        card_width: variant.width,
        card_height: variant.height,
        description_max_chars: variant.description_max_chars,
      });
    }

    // New multi-platform format
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
