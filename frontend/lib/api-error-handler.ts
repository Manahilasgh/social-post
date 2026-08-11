import { NextResponse } from "next/server";
import { HttpError } from "./get-current-user";

// Re-export HttpError for convenience
export { HttpError } from "./get-current-user";

/**
 * Convert an error into a proper NextResponse with appropriate status code
 * Handles HttpError instances with custom status codes, and generic errors
 */
export function handleApiError(error: unknown): NextResponse {
  console.error("API Error:", error);

  // If it's our custom HttpError with a status property
  if (error instanceof HttpError) {
    return NextResponse.json(
      { detail: error.message },
      { status: error.status }
    );
  }

  // If it's any error with a status property
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as any).status === "number"
  ) {
    return NextResponse.json(
      { detail: (error as Error).message || "An error occurred" },
      { status: (error as any).status }
    );
  }

  // Generic error - return 500
  if (error instanceof Error) {
    return NextResponse.json(
      { detail: error.message || "Internal server error" },
      { status: 500 }
    );
  }

  // Unknown error type
  return NextResponse.json(
    { detail: "Internal server error" },
    { status: 500 }
  );
}
