import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { handleApiError } from "@/lib/api-error-handler";
import { searchBackgroundImages } from "@/lib/image-search-service";

/**
 * GET /api/images/search?query=<search_term>
 * Search for background images using Pixabay API
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    await getCurrentUser(request);

    // Get query parameter
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query");

    if (!query || query.trim() === "") {
      return NextResponse.json(
        { error: "Query parameter is required and cannot be empty" },
        { status: 400 }
      );
    }

    // Call image search service
    let results;
    try {
      results = await searchBackgroundImages(query.trim());
    } catch (error) {
      // Handle service errors
      if (error instanceof Error) {
        if (error.message.includes("PIXABAY_API_KEY")) {
          return NextResponse.json(
            { error: "Image search service not configured" },
            { status: 500 }
          );
        }
        
        // Other service errors (network, API errors, etc.)
        return NextResponse.json(
          { error: `Image search failed: ${error.message}` },
          { status: 502 }
        );
      }

      // Unknown error type
      return NextResponse.json(
        { error: "Image search failed: Unknown error" },
        { status: 502 }
      );
    }

    // Check if we got any results
    if (!results || results.length === 0) {
      return NextResponse.json(
        { error: "No images found for the given query" },
        { status: 422 }
      );
    }

    return NextResponse.json(results);
  } catch (error) {
    return handleApiError(error);
  }
}