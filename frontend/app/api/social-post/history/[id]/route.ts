import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { handleApiError } from "@/lib/api-error-handler";
import { prisma } from "@/lib/prisma";

/**
 * Helper to fetch an entry and verify ownership.
 * Returns the entry if found and belongs to the user, otherwise throws 404.
 */
async function getOwnedEntry(id: number, userId: number) {
  const entry = await prisma.social_post_history.findFirst({
    where: {
      id,
      user_id: userId,
    },
  });

  if (!entry) {
    const error: any = new Error("Post not found");
    error.status = 404;
    throw error;
  }

  return entry;
}

/**
 * GET /api/social-post/history/[id]
 * Fetch a single history entry by id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    const { id } = await params;
    const entryId = parseInt(id, 10);

    if (isNaN(entryId)) {
      return NextResponse.json(
        { error: "Invalid id" },
        { status: 400 }
      );
    }

    const entry = await getOwnedEntry(entryId, user.id);
    return NextResponse.json(entry);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/social-post/history/[id]
 * Update an existing history entry's text fields
 * Does NOT update media_filename or publish_status
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    const { id } = await params;
    const entryId = parseInt(id, 10);

    if (isNaN(entryId)) {
      return NextResponse.json(
        { error: "Invalid id" },
        { status: 400 }
      );
    }

    // Verify ownership
    await getOwnedEntry(entryId, user.id);

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

    // Build update data - only include fields that are provided
    const updateData: any = {};

    if (query !== undefined) {
      if (typeof query !== "string" || !query.trim()) {
        return NextResponse.json(
          { error: "Query must be a non-empty string" },
          { status: 400 }
        );
      }
      updateData.query = query.trim();
    }

    if (headline !== undefined) updateData.headline = headline || null;
    if (description !== undefined) updateData.description = description || null;
    if (story_description !== undefined) updateData.story_description = story_description || null;
    if (hashtags !== undefined) updateData.hashtags = Array.isArray(hashtags) ? hashtags : [];
    if (news_results !== undefined) updateData.news_results = Array.isArray(news_results) ? news_results : [];
    if (settings_snapshot !== undefined) updateData.settings_snapshot = settings_snapshot || null;

    // Update the entry
    const updatedEntry = await prisma.social_post_history.update({
      where: { id: entryId },
      data: updateData,
    });

    return NextResponse.json(updatedEntry);
  } catch (error) {
    return handleApiError(error);
  }
}
