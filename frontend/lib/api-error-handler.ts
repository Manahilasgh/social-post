import { NextResponse } from "next/server";
import { HttpError } from "./get-current-user";

// Re-export HttpError for convenience
export { HttpError } from "./get-current-user";

/**
 * Convert an error into a proper NextResponse with appropriate status code
 * Handles HttpError instances with custom status codes, and generic errors
 */
export function handleApiError(error: unknown) {
  const message = error instanceof Error ? error.message : "An error occurred";
  const status = 
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status: number }).status
      : 500;

  return NextResponse.json({ detail: message }, { status });
}
