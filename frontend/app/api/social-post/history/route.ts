import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { handleApiError } from "@/lib/api-error-handler";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/social-post/history
 * Create a new draft post entry with platform variants
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const body = await request.json();

    const {
      query,
      headline,
      description,
      story_description,
      hashtags,
      news_results,
      settings_snapshot,
      variants,
    } = body;

    // Validate required fields
    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 }
      );
    }

    // Create the draft entry
    const entry = await prisma.social_post_history.create({
      data: {
        user_id: user.id,
        query: query.trim(),
        headline: headline || null,
        description: description || null,
        story_description: story_description || null,
        hashtags: Array.isArray(hashtags) ? hashtags : [],
        news_results: Array.isArray(news_results) ? news_results : [],
        settings_snapshot: settings_snapshot || null,
        publish_status: "draft",
        media_filename: null,
        published_at: null,
      },
    });

    // Create platform variants if provided
    if (variants && typeof variants === "object") {
      const variantPromises = Object.entries(variants).map(([platform, variantData]: [string, any]) => {
        return prisma.social_post_platform_variants.create({
          data: {
            history_id: entry.id,
            platform,
            description: variantData.description || null,
            aspect_ratio: variantData.aspect_ratio || null,
            width: variantData.width || null,
            height: variantData.height || null,
            publish_status: "draft",
          },
        });
      });

      await Promise.all(variantPromises);
    }

    // Fetch the created entry with variants included
    const entryWithVariants = await prisma.social_post_history.findUnique({
      where: { id: entry.id },
      include: {
        social_post_platform_variants: true,
      },
    });

    return NextResponse.json(entryWithVariants, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/social-post/history
 * List all history entries for the current user with platform variants
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    const entries = await prisma.social_post_history.findMany({
      where: {
        user_id: user.id,
      },
      include: {
        social_post_platform_variants: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return NextResponse.json(entries);
  } catch (error) {
    return handleApiError(error);
  }
}
