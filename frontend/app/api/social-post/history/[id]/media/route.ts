import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { handleApiError } from "@/lib/api-error-handler";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { randomBytes } from "crypto";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "social");
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
 * POST /api/social-post/history/[id]/media
 * Upload a card image for a history entry
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
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 10MB)" },
        { status: 413 }
      );
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename using crypto.randomBytes
    const randomHex = randomBytes(16).toString("hex");
    const filename = `${entryId}_${randomHex}.png`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Write file to disk
    await writeFile(filepath, buffer);

    // Delete old media file if it exists
    if (entry.media_filename) {
      const oldPath = path.join(UPLOAD_DIR, entry.media_filename);
      if (existsSync(oldPath)) {
        try {
          await unlink(oldPath);
        } catch (err) {
          console.warn(`Failed to delete old media file: ${oldPath}`, err);
        }
      }
    }

    // Update entry in database
    const updatedEntry = await prisma.social_post_history.update({
      where: { id: entryId },
      data: {
        media_filename: filename,
        publish_status: "media_ready",
      },
    });

    return NextResponse.json(updatedEntry);
  } catch (error) {
    return handleApiError(error);
  }
}
