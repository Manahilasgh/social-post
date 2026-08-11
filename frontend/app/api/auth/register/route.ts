import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createAccessToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error-handler";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { detail: "Email and password are required" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { detail: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if email is already taken
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { detail: "Email already registered" },
        { status: 409 }
      );
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const user = await prisma.users.create({
      data: {
        email,
        password_hash,
        name: name || null,
      },
    });

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
