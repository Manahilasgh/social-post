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

const API_BASE = "http://localhost:8000";

/**
 * Uploads the exported PNG to the backend's media endpoint for a given history entry.
 */
export async function uploadCardMedia(historyId: number, file: File): Promise<Response> {
  const formData = new FormData();
  formData.append("file", file);

  return fetch(`${API_BASE}/api/social-post/history/${historyId}/media`, {
    method: "POST",
    body: formData,
  });
}