import { domToPng } from "modern-screenshot";

/**
 * Captures the rendered card DOM node and returns it as a PNG File,
 * ready to be uploaded via the /media endpoint.
 *
 * Usage:
 *   const cardRef = useRef<HTMLDivElement>(null);
 *   const file = await exportCardAsPng(cardRef.current);
 */
export async function exportCardAsPng(
  node: HTMLElement,
  filename: string = "post-card.png"
): Promise<File> {
  const dataUrl = await domToPng(node, {
    width: 1080,
    height: 1350,
    scale: 1,
    backgroundColor: "#12151C",
  });

  const res = await fetch(dataUrl);
  const blob = await res.blob();

  return new File([blob], filename, { type: "image/png" });
}

/**
 * Uploads the exported PNG to the backend's media endpoint for a given history entry.
 */
export async function uploadCardMedia(historyId: number, file: File, token: string | null): Promise<Response> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api/social-post/history/${historyId}/media`, {
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