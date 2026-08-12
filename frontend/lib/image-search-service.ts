interface ImageResult {
  thumbnail: string;
  original: string;
  title: string;
  source: string;
}

/**
 * Search for background images using Pixabay API
 * 
 * @param query Search query string
 * @param numResults Number of results to return (default: 12, minimum: 3 per Pixabay requirement)
 * @returns Promise<ImageResult[]> Array of image results
 * @throws Error if PIXABAY_API_KEY is missing or API call fails
 */
export async function searchBackgroundImages(
  query: string,
  numResults: number = 12
): Promise<ImageResult[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  
  if (!apiKey) {
    throw new Error("PIXABAY_API_KEY environment variable is not configured");
  }

  // Ensure minimum results per Pixabay requirement
  const perPage = Math.max(numResults, 3);

  // Build Pixabay API URL
  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", encodeURIComponent(query));
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("per_page", perPage.toString());
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("category", "backgrounds,places,nature,business,people");

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Pixabay API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Check for API errors
    if (data.error) {
      throw new Error(`Pixabay API error: ${data.error}`);
    }

    // Extract hits array
    const hits = data.hits || [];
    
    if (hits.length === 0) {
      return [];
    }

    // Transform Pixabay results to our format
    const results: ImageResult[] = hits
      .slice(0, numResults)
      .map((hit: any) => ({
        thumbnail: hit.webformatURL || "",
        original: hit.largeImageURL || hit.fullHDURL || hit.webformatURL || "",
        title: hit.tags || "",
        source: "Pixabay",
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