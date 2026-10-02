import { domToPng } from "modern-screenshot";

/**
 * Captures the rendered card DOM node and returns it as a PNG File,
 * ready to be uploaded via the /media endpoint.
 */
export async function exportCardAsPng(
  node: HTMLElement,
  filename: string = "post-card.png",
  width: number = 1080,
  height: number = 1350
): Promise<File> {
  const dataUrl = await domToPng(node, {
    width,
    height,
    scale: 1,
    backgroundColor: "#12151C",
  });

  const res = await fetch(dataUrl);
  const blob = await res.blob();

  return new File([blob], filename, { type: "image/png" });
}

/**
 * Uploads the exported PNG to the backend's media endpoint for a given history entry and platform.
 * Requires the auth token for the Authorization header.
 */
export async function uploadCardMedia(
  historyId: number,
  platform: string,
  file: File,
  token: string | null
): Promise<Response> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api/social-post/history/${historyId}/media/${platform}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (res.status === 401) {
    localStorage.removeItem("auth_token");
    window.location.href = "/login";
    throw new Error("Unauthorized - redirecting to login");
  }

  return res;
}
