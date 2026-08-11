import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createAccessToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error-handler";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { detail: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.users.findUnique({
      where: { email },
    });

    // If user not found or password is wrong, return same error message
    // (don't reveal which one failed for security)
    if (!user) {
      return NextResponse.json(
        { detail: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { detail: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Create access token
    const access_token = await createAccessToken(user.id);

    return NextResponse.json({
      access_token,
      token_type: "bearer",
      user_id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
