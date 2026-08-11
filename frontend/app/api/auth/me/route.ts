import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { handleApiError } from "@/lib/api-error-handler";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    // Get the token from the header to return it in the response
    const authHeader = request.headers.get("Authorization");
    const token = authHeader!.substring(7);

    return NextResponse.json({
      access_token: token,
      token_type: "bearer",
      user_id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
