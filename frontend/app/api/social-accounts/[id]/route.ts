import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { handleApiError } from "@/lib/api-error-handler";
import { prisma } from "@/lib/prisma";

/**
 * Helper to fetch a social account and verify ownership.
 */
async function getOwnedAccount(id: number, userId: number) {
  const account = await prisma.social_accounts.findFirst({
    where: {
      id,
      user_id: userId,
    },
  });

  if (!account) {
    const error: any = new Error("Social account not found");
    error.status = 404;
    throw error;
  }

  return account;
}

/**
 * DELETE /api/social-accounts/[id]
 * Disconnect a social account by deleting it
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    const { id } = await params;
    const accountId = parseInt(id, 10);

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: "Invalid account ID" },
        { status: 400 }
      );
    }

    // Verify ownership
    const account = await getOwnedAccount(accountId, user.id);

    // Delete the social account
    await prisma.social_accounts.delete({
      where: { id: accountId },
    });

    return NextResponse.json({
      success: true,
      message: `${account.platform} account disconnected successfully`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}