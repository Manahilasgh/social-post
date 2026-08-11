import { NextRequest, NextResponse } from "next/server";
import { decodeAccessToken } from "@/lib/auth";

/**
 * GET /api/social-accounts/facebook/connect?token=<jwt>
 * Initiate Facebook OAuth flow
 * 
 * This endpoint is hit via browser redirect (not fetch), so the token
 * comes from a query parameter instead of Authorization header.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token parameter is required" },
        { status: 401 }
      );
    }

    // Decode token to get user ID
    let userId: number;
    try {
      userId = await decodeAccessToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Validate environment variables
    const appId = process.env.FACEBOOK_APP_ID;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

    if (!appId || !redirectUri) {
      console.error("Missing Facebook OAuth configuration");
      return NextResponse.json(
        { error: "Facebook OAuth not configured" },
        { status: 500 }
      );
    }

    // Build Facebook OAuth dialog URL
    const facebookAuthUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
    facebookAuthUrl.searchParams.set("client_id", appId);
    facebookAuthUrl.searchParams.set("redirect_uri", redirectUri);
    facebookAuthUrl.searchParams.set("scope", "pages_show_list,pages_manage_posts,pages_read_engagement");
    facebookAuthUrl.searchParams.set("state", String(userId));
    facebookAuthUrl.searchParams.set("response_type", "code");

    // Redirect to Facebook OAuth
    return NextResponse.redirect(facebookAuthUrl.toString());
  } catch (error) {
    console.error("Facebook connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Facebook OAuth" },
      { status: 500 }
    );
  }
}
