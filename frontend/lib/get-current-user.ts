import { prisma } from "./prisma";
import { decodeAccessToken } from "./auth";

/**
 * Custom error class with HTTP status code
 */
export class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

/**
 * Extract and validate the current user from the Authorization header
 * @throws {HttpError} with status 401 if authentication fails
 */
export async function getCurrentUser(request: Request) {
  // Get Authorization header
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HttpError("Missing or invalid authorization header", 401);
  }

  // Extract token
  const token = authHeader.substring(7); // Remove "Bearer " prefix

  // Decode token to get user ID
  let userId: number;
  try {
    userId = await decodeAccessToken(token);
  } catch (error) {
    throw new HttpError("Invalid or expired token", 401);
  }

  // Fetch user from database
  const user = await prisma.users.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new HttpError("User not found", 401);
  }

  return user;
}
