/**
 * Thin fetch wrapper used by every dashboard component.
 *
 * - Attaches Authorization: Bearer <token> to every request
 * - On 401, redirects to /login (session expired)
 * - On any other non-2xx, throws an Error with the backend detail message
 */

const API_BASE = "http://localhost:8000";
export { API_BASE };

function redirectToLogin() {
  // Use window.location so it works outside of React component trees
  // (e.g. inside the export utility callback)
  if (typeof window !== "undefined") {
    window.location.replace("/login");
  }
}

/** POST (or any method) with JSON body + auth header. */
export async function apiFetch<T>(
  url: string,
  body: unknown,
  token: string | null,
  method = "POST"
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    redirectToLogin();
    // Throw so callers don't try to continue with a null response
    throw new Error("Session expired. Redirecting to login…");
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const err = await res.json();
      message = err.detail ?? err.message ?? message;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(`${res.status}: ${message}`);
  }

  return res.json() as Promise<T>;
}

/** GET with auth header. */
export async function apiGet<T>(url: string, token: string | null): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { headers });

  if (res.status === 401) {
    redirectToLogin();
    throw new Error("Session expired. Redirecting to login…");
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const err = await res.json();
      message = err.detail ?? err.message ?? message;
    } catch {
      // ignore
    }
    throw new Error(`${res.status}: ${message}`);
  }

  return res.json() as Promise<T>;
}

/** Multipart POST (FormData) with auth header — used for file uploads. */
export async function apiUpload(
  url: string,
  formData: FormData,
  token: string | null
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });

  if (res.status === 401) {
    redirectToLogin();
    throw new Error("Session expired. Redirecting to login…");
  }

  return res;
}
