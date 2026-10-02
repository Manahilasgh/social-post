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
    include: {
      social_post_platform_variants: true,
    },
  });

  if (!entry) {
    const error: any = new Error("Post not found");
    error.status = 404;
    throw error;
  }

  return entry;
}

interface PublicationResult {
  platform: string;
  status: string;
  external_id: string | null;
  external_url: string | null;
  error: string | null;
}

/**
 * GET /api/social-post/history/[id]/publish
 * Get platforms that are ready to publish (have media_url and status is "media_ready")
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
    const entry = await getOwnedEntry(entryId, user.id);

    // Find platforms that are ready to publish
    const readyPlatforms = entry.social_post_platform_variants
      .filter(variant => 
        variant.publish_status === "media_ready" && 
        variant.media_url
      )
      .map(variant => variant.platform);

    return NextResponse.json({
      ready_platforms: readyPlatforms,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/social-post/history/[id]/publish
 * Publish post to platform variants - auto-detects ready platforms if none specified
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

    // Verify ownership and get entry with variants
    const entry = await getOwnedEntry(entryId, user.id);

    // Parse request body - platforms is now optional
    const body = await request.json().catch(() => ({}));
    let { platforms } = body;

    // If no platforms specified, auto-detect ready platforms
    if (!platforms || !Array.isArray(platforms)) {
      platforms = entry.social_post_platform_variants
        .filter(variant => 
          variant.publish_status === "media_ready" && 
          variant.media_url
        )
        .map(variant => variant.platform);
    }

    if (platforms.length === 0) {
      return NextResponse.json(
        { error: "No platforms ready to publish. Upload images first." },
        { status: 400 }
      );
    }

    // Publish to each platform
    const results: PublicationResult[] = [];

    for (const platform of platforms) {
      // Find the platform variant
      const variant = entry.social_post_platform_variants.find(
        v => v.platform === platform
      );

      if (!variant) {
        const result: PublicationResult = {
          platform,
          status: "failed",
          external_id: null,
          external_url: null,
          error: `Platform variant '${platform}' not found`,
        };
        results.push(result);
        continue;
      }

      if (!variant.media_url) {
        const result: PublicationResult = {
          platform,
          status: "failed",
          external_id: null,
          external_url: null,
          error: `No image uploaded for platform '${platform}'`,
        };
        results.push(result);
        continue;
      }

      // Build caption from headline + variant description + hashtags
      const captionParts = [entry.headline, variant.description].filter(Boolean);
      let caption = captionParts.join("\n\n");

      if (entry.hashtags && Array.isArray(entry.hashtags) && entry.hashtags.length > 0) {
        const hashtagString = (entry.hashtags as string[])
          .map((tag: string) => `#${tag.replace(/\s+/g, "")}`)
          .join(" ");
        caption += `\n\n${hashtagString}`;
      }

      let result: PublicationResult;

      if (platform === "facebook") {
        // Find Facebook account for this user
        const account = await prisma.social_accounts.findFirst({
          where: {
            user_id: user.id,
            platform: "facebook",
          },
        });

        if (!account) {
          result = {
            platform: "facebook",
            status: "failed",
            external_id: null,
            external_url: null,
            error: "No connected Facebook account found for this user",
          };
        } else {
          // Publish to Facebook using the variant's media_url (Blob URL)
          const outcome = await publishPhotoToFacebookPage(
            account.platform_account_id,
            account.access_token,
            variant.media_url,
            caption
          );

          result = {
            platform: "facebook",
            status: outcome.success ? "success" : "failed",
            external_id: outcome.external_id,
            external_url: outcome.external_url,
            error: outcome.error,
          };

          // Update the variant's publish status
          if (outcome.success) {
            await prisma.social_post_platform_variants.update({
              where: { id: variant.id },
              data: {
                publish_status: "published",
                external_id: outcome.external_id,
                external_url: outcome.external_url,
                error: null,
                published_at: new Date(),
              },
            });
          } else {
            await prisma.social_post_platform_variants.update({
              where: { id: variant.id },
              data: {
                publish_status: "failed",
                error: outcome.error,
              },
            });
          }
        }
      } else {
        result = {
          platform,
          status: "failed",
          external_id: null,
          external_url: null,
          error: `Platform '${platform}' publishing not implemented yet`,
        };

        // Update variant status for unsupported platforms
        await prisma.social_post_platform_variants.update({
          where: { id: variant.id },
          data: {
            publish_status: "failed",
            error: result.error,
          },
        });
      }

      results.push(result);

      // Record publication attempt in database
      await prisma.social_post_publications.create({
        data: {
          history_id: entryId,
          platform: result.platform,
          status: result.status,
          external_id: result.external_id,
          external_url: result.external_url,
          error: result.error,
        },
      });
    }

    // Determine overall publish status based on all variants
    const successCount = results.filter(r => r.status === "success").length;
    const failureCount = results.filter(r => r.status === "failed").length;
    
    let overallStatus: string;
    let publishedAt: Date | null = null;

    if (successCount > 0 && failureCount === 0) {
      overallStatus = "published";
      publishedAt = new Date();
    } else if (successCount > 0 && failureCount > 0) {
      overallStatus = "partial";
      publishedAt = new Date();
    } else {
      overallStatus = "failed";
    }

    // Update main history entry status
    await prisma.social_post_history.update({
      where: { id: entryId },
      data: {
        publish_status: overallStatus,
        published_at: publishedAt,
      },
    });

    return NextResponse.json({
      history_id: entryId,
      publish_status: overallStatus,
      results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
