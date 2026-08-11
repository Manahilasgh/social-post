import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { handleApiError } from "@/lib/api-error-handler";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/social-accounts
 * List all connected social accounts for the current user
 * Never returns access_token for security
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    const accounts = await prisma.social_accounts.findMany({
      where: {
        user_id: user.id,
      },
      select: {
        id: true,
        platform: true,
        platform_account_id: true,
        display_name: true,
        // Explicitly exclude access_token and other sensitive fields
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    return handleApiError(error);
  }
}
