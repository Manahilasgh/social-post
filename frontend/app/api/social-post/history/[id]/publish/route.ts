import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { handleApiError } from "@/lib/api-error-handler";
import { prisma } from "@/lib/prisma";
import { publishPhotoToFacebookPage } from "@/lib/social-post-publish-service";

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
 * Helper to check if media_filename is a blob URL or old filename
 */
function isBlobUrl(url: string): boolean {
  return url.startsWith('http');
}

interface PublicationResult {
  platform: string;
  status: string;
  external_id: string | null;
  external_url: string | null;
  error: string | null;
}

/**
 * POST /api/social-post/history/[id]/publish
 * Publish a post to selected platforms
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

    // Check that media is uploaded
    if (!entry.media_filename) {
      return NextResponse.json(
        { error: "No media attached to this post yet — upload an image first" },
        { status: 400 }
      );
    }

    // media_filename now contains either a Blob URL or legacy filename
    const imageUrl = entry.media_filename;

    // Parse request body
    const body = await request.json();
    const { platforms = ["facebook"] } = body;

    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: "At least one platform must be specified" },
        { status: 400 }
      );
    }

    // Build caption from headline + story_description + hashtags
    const captionParts = [entry.headline, entry.story_description].filter(Boolean);
    let caption = captionParts.join("\n\n");

    if (entry.hashtags && Array.isArray(entry.hashtags) && entry.hashtags.length > 0) {
      const hashtagString = (entry.hashtags as string[])
        .map((tag: string) => `#${tag.replace(/\s+/g, "")}`)
        .join(" ");
      caption += `\n\n${hashtagString}`;
    }

    // Publish to each platform
    const results: PublicationResult[] = [];
    let anySuccess = false;
    let anyFailure = false;

    for (const platform of platforms) {
      if (platform !== "facebook") {
        const result: PublicationResult = {
          platform,
          status: "failed",
          external_id: null,
          external_url: null,
          error: "Only Facebook publishing is implemented right now",
        };
        results.push(result);
        anyFailure = true;
        continue;
      }

      // Find Facebook account for this user
      const account = await prisma.social_accounts.findFirst({
        where: {
          user_id: user.id,
          platform: "facebook",
        },
      });

      if (!account) {
        const result: PublicationResult = {
          platform: "facebook",
          status: "failed",
          external_id: null,
          external_url: null,
          error: "No connected Facebook account found for this user",
        };
        results.push(result);
        anyFailure = true;
      } else {
        // Attempt to publish using the Facebook service
        // Pass the image URL (now supports both blob URLs and legacy local paths)
        const outcome = await publishPhotoToFacebookPage(
          account.platform_account_id,
          account.access_token,
          imageUrl,
          caption
        );

        const result: PublicationResult = {
          platform: "facebook",
          status: outcome.success ? "success" : "failed",
          external_id: outcome.external_id,
          external_url: outcome.external_url,
          error: outcome.error,
        };
        results.push(result);

        anySuccess = anySuccess || outcome.success;
        anyFailure = anyFailure || !outcome.success;
      }

      // Record publication attempt in database
      await prisma.social_post_publications.create({
        data: {
          history_id: entryId,
          platform: results[results.length - 1].platform,
          status: results[results.length - 1].status,
          external_id: results[results.length - 1].external_id,
          external_url: results[results.length - 1].external_url,
          error: results[results.length - 1].error,
        },
      });
    }

    // Update history entry status
    let publishStatus: string;
    let publishedAt: Date | null = null;

    if (anySuccess && !anyFailure) {
      publishStatus = "published";
      publishedAt = new Date();
    } else if (anySuccess && anyFailure) {
      publishStatus = "partial";
      publishedAt = new Date();
    } else {
      publishStatus = "failed";
    }

    await prisma.social_post_history.update({
      where: { id: entryId },
      data: {
        publish_status: publishStatus,
        published_at: publishedAt,
      },
    });

    return NextResponse.json({
      history_id: entryId,
      publish_status: publishStatus,
      results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
