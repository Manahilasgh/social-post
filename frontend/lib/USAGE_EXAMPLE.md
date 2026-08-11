# API Route Helpers - Usage Examples

## getCurrentUser Helper

Use this helper to get the authenticated user in any protected API route.

### Example: Protected API Route

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { handleApiError } from "@/lib/api-error-handler";

export async function GET(request: NextRequest) {
  try {
    // This will throw an HttpError (401) if authentication fails
    const user = await getCurrentUser(request);
    
    // Now you can use user.id, user.email, user.name
    return NextResponse.json({
      message: "Success",
      userId: user.id,
      email: user.email,
    });
  } catch (error) {
    // Automatically converts HttpError to proper NextResponse with status code
    return handleApiError(error);
  }
}
```

### Example: POST Route with User-Specific Data

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { handleApiError } from "@/lib/api-error-handler";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const body = await request.json();
    
    // Create a resource owned by the authenticated user
    const post = await prisma.social_post_history.create({
      data: {
        user_id: user.id,
        query: body.query,
        // ... other fields
      },
    });
    
    return NextResponse.json(post);
  } catch (error) {
    return handleApiError(error);
  }
}
```

## Custom HTTP Errors

You can throw custom HttpError instances with any status code:

```typescript
import { HttpError } from "@/lib/get-current-user";
import { handleApiError } from "@/lib/api-error-handler";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const body = await request.json();
    
    // Custom validation
    if (!body.title) {
      throw new HttpError("Title is required", 400);
    }
    
    // Custom authorization check
    if (user.role !== "admin") {
      throw new HttpError("Forbidden: Admin access required", 403);
    }
    
    // Your logic here...
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
```

## Error Handling

The `handleApiError` helper handles:
- **HttpError instances** - Returns the custom status code and message
- **Any error with a `status` property** - Returns that status code
- **Generic Error instances** - Returns 500 with the error message
- **Unknown errors** - Returns 500 with "Internal server error"

All errors are automatically logged to the console for debugging.

## Authentication Flow

1. Client sends request with `Authorization: Bearer <token>` header
2. `getCurrentUser` extracts and validates the token
3. If valid, returns the user object from the database
4. If invalid, throws HttpError with 401 status
5. `handleApiError` converts the error to a proper JSON response

## Error Messages

- **401 "Missing or invalid authorization header"** - No Bearer token provided
- **401 "Invalid or expired token"** - Token signature invalid or expired
- **401 "User not found"** - Token valid but user doesn't exist in DB
