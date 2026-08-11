import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Exchange authorization code for short-lived access token
 */
async function exchangeCodeForToken(code: string): Promise<string> {
  const appId = process.env.FACEBOOK_APP_ID!;
  const appSecret = process.env.FACEBOOK_APP_SECRET!;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI!;

  const tokenUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const response = await fetch(tokenUrl.toString());
  if (!response.ok) {
    const error = await response.text();
    console.error("Token exchange failed:", error);
    throw new Error("token_exchange");
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Upgrade short-lived token to long-lived token (60 days)
 */
async function upgradToLongLivedToken(shortLivedToken: string): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  const appId = process.env.FACEBOOK_APP_ID!;
  const appSecret = process.env.FACEBOOK_APP_SECRET!;

  const upgradeUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
  upgradeUrl.searchParams.set("grant_type", "fb_exchange_token");
  upgradeUrl.searchParams.set("client_id", appId);
  upgradeUrl.searchParams.set("client_secret", appSecret);
  upgradeUrl.searchParams.set("fb_exchange_token", shortLivedToken);

  const response = await fetch(upgradeUrl.toString());
  if (!response.ok) {
    const error = await response.text();
    console.error("Token upgrade failed:", error);
    throw new Error("token_upgrade");
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
  };
}

/**
 * Fetch user's Facebook Pages
 */
async function fetchPages(accessToken: string): Promise<Array<{
  id: string;
  name: string;
  access_token: string;
}>> {
  const pagesUrl = new URL("https://graph.facebook.com/v18.0/me/accounts");
  pagesUrl.searchParams.set("access_token", accessToken);

  const response = await fetch(pagesUrl.toString());
  if (!response.ok) {
    const error = await response.text();
    console.error("Pages fetch failed:", error);
    throw new Error("pages_fetch");
  }

  const data = await response.json();
  if (!data.data || data.data.length === 0) {
    throw new Error("no_pages");
  }

  return data.data;
}

/**
 * GET /api/social-accounts/facebook/callback?code=...&state=...
 * Facebook OAuth callback handler
 */
export async function GET(request: NextRequest) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const searchParams = request.nextUrl.searchParams;
  
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // Handle OAuth errors (user declined, etc.)
  const error = searchParams.get("error");
  if (error) {
    const errorReason = searchParams.get("error_reason") || "unknown";
    return NextResponse.redirect(
      `${frontendUrl}/dashboard/accounts?fb_error=${errorReason}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${frontendUrl}/dashboard/accounts?fb_error=missing_params`
    );
  }

  const userId = parseInt(state, 10);
  if (isNaN(userId)) {
    return NextResponse.redirect(
      `${frontendUrl}/dashboard/accounts?fb_error=invalid_state`
    );
  }

  try {
    // Step 1: Exchange code for short-lived token
    const shortLivedToken = await exchangeCodeForToken(code);

    // Step 2: Upgrade to long-lived token
    const { access_token: longLivedToken, expires_in } = await upgradToLongLivedToken(shortLivedToken);

    // Step 3: Fetch user's Facebook Pages
    const pages = await fetchPages(longLivedToken);

    // Step 4: Upsert each page into social_accounts
    const pageNames: string[] = [];
    const tokenExpiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000)
      : null;

    for (const page of pages) {
      await prisma.social_accounts.upsert({
        where: {
          // Composite unique constraint: user_id + platform + platform_account_id
          // Since Prisma doesn't support composite unique on this table,
          // we'll use a workaround with findFirst + create/update
          id: 0, // Dummy value, will use custom logic below
        },
        update: {
          access_token: page.access_token,
          display_name: page.name,
          token_expires_at: tokenExpiresAt,
          updated_at: new Date(),
        },
        create: {
          user_id: userId,
          platform: "facebook",
          platform_account_id: page.id,
          display_name: page.name,
          access_token: page.access_token,
          token_expires_at: tokenExpiresAt,
        },
      }).catch(async () => {
        // If upsert fails due to unique constraint, try manual approach
        const existing = await prisma.social_accounts.findFirst({
          where: {
            user_id: userId,
            platform: "facebook",
            platform_account_id: page.id,
          },
        });

        if (existing) {
          await prisma.social_accounts.update({
            where: { id: existing.id },
            data: {
              access_token: page.access_token,
              display_name: page.name,
              token_expires_at: tokenExpiresAt,
              updated_at: new Date(),
            },
          });
        } else {
          await prisma.social_accounts.create({
            data: {
              user_id: userId,
              platform: "facebook",
              platform_account_id: page.id,
              display_name: page.name,
              access_token: page.access_token,
              token_expires_at: tokenExpiresAt,
            },
          });
        }
      });

      pageNames.push(page.name);
    }

    // Success redirect
    const successUrl = new URL(`${frontendUrl}/dashboard/accounts`);
    successUrl.searchParams.set("fb_connected", "true");
    successUrl.searchParams.set("pages", pageNames.join(","));

    return NextResponse.redirect(successUrl.toString());
  } catch (error) {
    console.error("Facebook callback error:", error);
    
    // Determine error reason
    let errorReason = "unknown";
    if (error instanceof Error) {
      errorReason = error.message;
    }

    const errorUrl = new URL(`${frontendUrl}/dashboard/accounts`);
    errorUrl.searchParams.set("fb_error", errorReason);

    return NextResponse.redirect(errorUrl.toString());
  }
}
