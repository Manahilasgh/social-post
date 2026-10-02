import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { handleApiError } from "@/lib/api-error-handler";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";
import { randomBytes } from "crypto";

const ALLOWED_CONTENT_TYPES = ["image/png"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Helper to fetch a history entry and verify ownership.
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
 * Helper to check if a URL is a Vercel Blob URL
 */
function isBlobUrl(url: string): boolean {
  return url.includes('blob.vercel-storage.com') || url.startsWith('https://') && url.includes('blob');
}

/**
 * POST /api/social-post/history/[id]/media/[platform]
 * Upload a card image for a specific platform variant using Vercel Blob
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; platform: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    const { id, platform } = await params;
    const entryId = parseInt(id, 10);

    if (isNaN(entryId)) {
      return NextResponse.json(
        { error: "Invalid history ID" },
        { status: 400 }
      );
    }

    if (!platform || typeof platform !== "string") {
      return NextResponse.json(
        { error: "Invalid platform" },
        { status: 400 }
      );
    }

    // Verify ownership of the parent history entry
    const entry = await getOwnedEntry(entryId, user.id);

    // Find the specific platform variant
    const variant = await prisma.social_post_platform_variants.findFirst({
      where: {
        history_id: entryId,
        platform: platform,
      },
    });

    if (!variant) {
      return NextResponse.json(
        { error: `Platform variant '${platform}' not found for this post` },
        { status: 404 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate content type
    if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PNG files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 10MB)" },
        { status: 413 }
      );
    }

    // Generate unique filename using crypto.randomBytes
    const randomHex = randomBytes(16).toString("hex");
    const blobPath = `social/${entryId}-${platform}-${randomHex}.png`;

    // Upload to Vercel Blob
    const blob = await put(blobPath, fileBuffer, {
      access: "public",
      contentType: "image/png",
    });

    // Delete old blob if it exists and is a blob URL
    if (variant.media_url && isBlobUrl(variant.media_url)) {
      try {
        await del(variant.media_url);
      } catch (err) {
        console.warn(`Failed to delete old blob: ${variant.media_url}`, err);
      }
    }

    // Update the platform variant with the new media URL
    const updatedVariant = await prisma.social_post_platform_variants.update({
      where: { id: variant.id },
      data: {
        media_url: blob.url,
        publish_status: "media_ready",
        updated_at: new Date(),
      },
    });

    // Keep the parent row's legacy single-image column in sync. The history
    // gallery and detail panel read `media_filename`, so without this an
    // uploaded card image would never show up as a thumbnail.
    await prisma.social_post_history.update({
      where: { id: entryId },
      data: {
        media_filename: blob.url,
        // Only advance the post-level status while it is still a draft —
        // never downgrade a post that is already published.
        ...(entry.publish_status === "draft" || !entry.publish_status
          ? { publish_status: "media_ready" }
          : {}),
      },
    });

    return NextResponse.json(updatedVariant);
  } catch (error) {
    return handleApiError(error);
  }
}