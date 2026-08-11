import { readFile } from "fs/promises";
import { existsSync } from "fs";

interface PublishResult {
  success: boolean;
  external_id: string | null;
  external_url: string | null;
  error: string | null;
}

/**
 * Publish a photo to a Facebook Page using the Graph API
 * 
 * @param pageId Facebook Page ID
 * @param pageAccessToken Page access token with publishing permissions
 * @param imagePath Absolute path to the image file on disk
 * @param caption Caption text for the post
 * @returns Promise<PublishResult> - Never throws, always returns success/error info
 */
export async function publishPhotoToFacebookPage(
  pageId: string,
  pageAccessToken: string,
  imagePath: string,
  caption: string
): Promise<PublishResult> {
  try {
    // Check if file exists
    if (!existsSync(imagePath)) {
      return {
        success: false,
        external_id: null,
        external_url: null,
        error: "Image file not found",
      };
    }

    // Read the image file from disk
    const imageBuffer = await readFile(imagePath);
    
    // Create a Blob from the buffer
    const imageBlob = new Blob([imageBuffer], { type: "image/png" });

    // Create FormData for multipart/form-data request
    const formData = new FormData();
    formData.append("source", imageBlob, "image.png");
    formData.append("caption", caption);
    formData.append("access_token", pageAccessToken);

    // Make the API call to Facebook Graph API
    const response = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      // Try to get error details from Facebook's response
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error && errorData.error.message) {
          errorMessage = `Facebook API Error: ${errorData.error.message}`;
          if (errorData.error.code) {
            errorMessage += ` (Code: ${errorData.error.code})`;
          }
        }
      } catch {
        // If we can't parse the error response, use the HTTP status
      }

      return {
        success: false,
        external_id: null,
        external_url: null,
        error: errorMessage,
      };
    }

    // Parse successful response
    const data = await response.json();
    
    // Facebook returns { id: "pageId_postId", post_id: "pageId_postId" }
    const postId = data.post_id || data.id;
    
    if (!postId) {
      return {
        success: false,
        external_id: null,
        external_url: null,
        error: "Facebook API returned success but no post ID",
      };
    }

    // Build the Facebook URL
    const externalUrl = `https://www.facebook.com/${postId}`;

    return {
      success: true,
      external_id: postId,
      external_url: externalUrl,
      error: null,
    };
  } catch (error) {
    // Catch all other errors (network, file system, etc.)
    let errorMessage = "Unknown error occurred";
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    return {
      success: false,
      external_id: null,
      external_url: null,
      error: errorMessage,
    };
  }
}