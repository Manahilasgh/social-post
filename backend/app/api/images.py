import requests
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

from app.services.image_search_service import search_background_images

router = APIRouter(prefix="/api/images", tags=["images"])


@router.get("/proxy")
def proxy_image(url: str = Query(...)):
    """
    Fetches an external image server-side and re-serves it from our own domain.
    This lets the frontend canvas-capture (domToPng) the image without hitting
    cross-origin taint restrictions, since the browser now sees it as same-origin
    to our API (and we explicitly allow CORS on this response).
    """
    try:
        resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch image: {str(e)}")

    content_type = resp.headers.get("Content-Type", "image/jpeg")

    return Response(
        content=resp.content,
        media_type=content_type,
        headers={"Access-Control-Allow-Origin": "*"},
    )


class ImageResult(BaseModel):
    thumbnail: str | None
    original: str | None
    title: str | None
    source: str | None


@router.get("/search", response_model=list[ImageResult])
def search_images(query: str = Query(...)):
    query = query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        results = search_background_images(query)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not results:
        raise HTTPException(status_code=422, detail="No images found for this query")

    return results