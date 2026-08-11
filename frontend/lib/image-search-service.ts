interface ImageResult {
  thumbnail: string;
  original: string;
  title: string;
  source: string;
}

/**
 * Search for background images using SerpAPI Google Images
 * 
 * @param query Search query string
 * @param numResults Number of results to return (default: 12)
 * @returns Promise<ImageResult[]> Array of image results
 * @throws Error if SERPAPI_KEY is missing or API call fails
 */
export async function searchBackgroundImages(
  query: string,
  numResults: number = 12
): Promise<ImageResult[]> {
  const apiKey = process.env.SERPAPI_KEY;
  
  if (!apiKey) {
    throw new Error("SERPAPI_KEY environment variable is not configured");
  }

  // Build SerpAPI URL
  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google_images");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", numResults.toString());

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`SerpAPI request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Check for API errors
    if (data.error) {
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    // Extract images_results array
    const imagesResults = data.images_results || [];
    
    if (imagesResults.length === 0) {
      return [];
    }

    // Transform and slice to requested number
    const results: ImageResult[] = imagesResults
      .slice(0, numResults)
      .map((item: any) => ({
        thumbnail: item.thumbnail || "",
        original: item.original || item.link || "",
        title: item.title || "",
        source: item.source || "",
      }))
      // Filter out any results with missing essential fields
      .filter((item: ImageResult) => item.thumbnail && item.original);

    return results;
  } catch (error) {
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Image search failed: ${error.message}`);
    }
    throw new Error("Image search failed: Unknown error");
  }
}