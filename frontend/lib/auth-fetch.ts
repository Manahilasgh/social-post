/**
 * Helper function to make authenticated API calls.
 * Automatically includes the Authorization header with the stored token.
 * Redirects to /login on 401 responses.
 */
export async function authFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("auth_token");
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Redirect to login on 401
  if (response.status === 401) {
    localStorage.removeItem("auth_token");
    window.location.href = "/login";
    throw new Error("Unauthorized - redirecting to login");
  }

  return response;
}
