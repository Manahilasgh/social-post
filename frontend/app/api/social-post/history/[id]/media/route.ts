import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { handleApiError } from "@/lib/api-error-handler";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";
import { randomBytes } from "crypto";

const ALLOWED_CONTENT_TYPES = ["image/png"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Helper to fetch an entry and verify ownership.
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
 * POST /api/social-post/history/[id]/media
 * Upload a card image for a history entry using Vercel Blob
 */
export async function POST(
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
    const entry = await getOwnedEntry(entryId, user.id);

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
    const blobPath = `social/${entryId}_${randomHex}.png`;

    // Upload to Vercel Blob
    const blob = await put(blobPath, fileBuffer, {
      access: "public",
      contentType: "image/png",
    });

    // Delete old blob if it exists and is a blob URL
    if (entry.media_filename && isBlobUrl(entry.media_filename)) {
      try {
        await del(entry.media_filename);
      } catch (err) {
        console.warn(`Failed to delete old blob: ${entry.media_filename}`, err);
      }
    }

    // Update entry in database - store the full blob URL
    const updatedEntry = await prisma.social_post_history.update({
      where: { id: entryId },
      data: {
        media_filename: blob.url, // Store the full URL instead of just filename
        publish_status: "media_ready",
      },
    });

    return NextResponse.json(updatedEntry);
  } catch (error) {
    return handleApiError(error);
  }
}
