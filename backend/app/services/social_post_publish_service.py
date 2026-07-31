import requests

FB_API_VERSION = "v21.0"
FB_GRAPH_URL = f"https://graph.facebook.com/{FB_API_VERSION}"


def publish_photo_to_facebook_page(page_id: str, page_access_token: str, image_path: str, caption: str) -> dict:
    """
    Uploads a local image file and publishes it as a photo post to a Facebook Page,
    with the given caption as the post's message.

    Returns a dict: {"success": bool, "external_id": str | None, "external_url": str | None, "error": str | None}
    """
    url = f"{FB_GRAPH_URL}/{page_id}/photos"

    try:
        with open(image_path, "rb") as image_file:
            files = {"source": image_file}
            data = {
                "caption": caption,
                "access_token": page_access_token,
            }
            response = requests.post(url, files=files, data=data, timeout=30)
    except FileNotFoundError:
        return {"success": False, "external_id": None, "external_url": None, "error": f"Image file not found: {image_path}"}
    except requests.RequestException as e:
        return {"success": False, "external_id": None, "external_url": None, "error": f"Network error calling Facebook: {str(e)}"}

    if not response.ok:
        try:
            error_detail = response.json().get("error", {}).get("message", response.text)
        except ValueError:
            error_detail = response.text
        return {"success": False, "external_id": None, "external_url": None, "error": error_detail}

    result = response.json()
    post_id = result.get("post_id") or result.get("id")

    external_url = None
    if post_id:
        # post_id from /photos is usually "{page_id}_{post_id}" — build a viewable link
        external_url = f"https://www.facebook.com/{post_id}"

    return {"success": True, "external_id": post_id, "external_url": external_url, "error": None}