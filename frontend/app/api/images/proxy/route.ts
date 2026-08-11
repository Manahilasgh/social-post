import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/images/proxy?url=<image_url>
 * Proxy external images to avoid CORS issues with canvas capture
 * No authentication required (used directly as img src)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "URL parameter is required" },
        { status: 400 }
      );
    }

    // Validate URL format
    let imageUrl: URL;
    try {
      imageUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Only allow HTTP(S) URLs
    if (!["http:", "https:"].includes(imageUrl.protocol)) {
      return NextResponse.json(
        { error: "Only HTTP(S) URLs are allowed" },
        { status: 400 }
      );
    }

    try {
      // Fetch the image with a proper User-Agent
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch image: ${response.status} ${response.statusText}` },
          { status: response.status }
        );
      }

      // Get the content type from the original response
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      
      // Validate that it's an image
      if (!contentType.startsWith("image/")) {
        return NextResponse.json(
          { error: "URL does not point to an image" },
          { status: 400 }
        );
      }

      // Get the image data
      const imageBuffer = await response.arrayBuffer();

      // Return the image with CORS headers
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type",
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
      });
    } catch (error) {
      console.error("Image proxy error:", error);
      
      return NextResponse.json(
        { error: "Failed to fetch image from external source" },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Image proxy error:", error);
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}