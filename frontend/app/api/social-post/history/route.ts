import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { handleApiError } from "@/lib/api-error-handler";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/social-post/history
 * Create a new draft post entry
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

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/social-post/history
 * List all history entries for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    const entries = await prisma.social_post_history.findMany({
      where: {
        user_id: user.id,
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
