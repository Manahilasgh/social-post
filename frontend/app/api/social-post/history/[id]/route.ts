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
 * Fetch a single history entry by id with platform variants
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

    // Verify ownership and get entry with variants
    await getOwnedEntry(entryId, user.id);
    
    const entryWithVariants = await prisma.social_post_history.findUnique({
      where: { id: entryId },
      include: {
        social_post_platform_variants: true,
      },
    });

    return NextResponse.json(entryWithVariants);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/social-post/history/[id]
 * Update an existing history entry's text fields and platform variants
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
      variants,
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

    // Handle platform variants if provided
    if (variants && typeof variants === "object") {
      const variantPromises = Object.entries(variants).map(async ([platform, variantData]: [string, any]) => {
        // Check if variant exists
        const existingVariant = await prisma.social_post_platform_variants.findFirst({
          where: {
            history_id: entryId,
            platform: platform,
          },
        });

        if (existingVariant) {
          // Update existing variant
          return prisma.social_post_platform_variants.update({
            where: { id: existingVariant.id },
            data: {
              description: variantData.description || null,
              aspect_ratio: variantData.aspect_ratio || null,
              width: variantData.width || null,
              height: variantData.height || null,
              updated_at: new Date(),
            },
          });
        } else {
          // Create new variant
          return prisma.social_post_platform_variants.create({
            data: {
              history_id: entryId,
              platform: platform,
              description: variantData.description || null,
              aspect_ratio: variantData.aspect_ratio || null,
              width: variantData.width || null,
              height: variantData.height || null,
              publish_status: "draft",
            },
          });
        }
      });

      await Promise.all(variantPromises);
    }

    // Fetch the updated entry with variants included
    const entryWithVariants = await prisma.social_post_history.findUnique({
      where: { id: entryId },
      include: {
        social_post_platform_variants: true,
      },
    });

    return NextResponse.json(entryWithVariants);
  } catch (error) {
    return handleApiError(error);
  }
}
