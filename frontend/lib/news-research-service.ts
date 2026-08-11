interface SerpApiResponse {
  news_results?: Array<{
    title?: string;
    snippet?: string;
    link?: string;
    source?: string | { name: string };
    date?: string;
    thumbnail?: string;
  }>;
}

export interface NewsResult {
  title: string;
  snippet: string;
  link: string;
  source: string;
  date: string;
  thumbnail: string;
}

/**
 * Fetch Google News results via SerpAPI
 * @param query Search query
 * @param numResults Maximum number of results to return (default: 10)
 * @returns Array of news results
 * @throws Error if SERPAPI_KEY is not set or API call fails
 */
export async function fetchGoogleNewsLight(
  query: string,
  numResults = 10
): Promise<NewsResult[]> {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    throw new Error("SERPAPI_KEY environment variable is not set");
  }

  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google_news");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`SerpAPI request failed: ${response.statusText}`);
  }

  const data: SerpApiResponse = await response.json();

  if (!data.news_results || data.news_results.length === 0) {
    return [];
  }

  // Map and normalize the results
  const results: NewsResult[] = data.news_results
    .slice(0, numResults)
    .map((item) => {
      // Handle source field - can be string or {name: string}
      const source =
        typeof item.source === "string"
          ? item.source
          : item.source?.name || "Unknown";

      return {
        title: item.title || "",
        snippet: item.snippet || "",
        link: item.link || "",
        source,
        date: item.date || "",
        thumbnail: item.thumbnail || "",
      };
    })
    .filter((item) => item.title && item.link); // Filter out empty entries

  return results;
}
