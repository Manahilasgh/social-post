import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.social_post_history import SocialPostHistory
from app.models.social_post_publication import SocialPostPublication
from app.models.social_account import SocialAccount
from app.services.news_research_service import fetch_google_news_light
from app.services.llm_service import generate_post_copy
from app.services.social_post_publish_service import publish_photo_to_facebook_page

router = APIRouter(prefix="/api/social-post", tags=["social-post"])

UPLOAD_DIR = os.path.join("uploads", "social")
ALLOWED_CONTENT_TYPES = {"image/png"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


# ---------- /generate (unchanged) ----------

class GenerateRequest(BaseModel):
    query: str


class GenerateResponse(BaseModel):
    headline: str
    description: str
    story_description: str
    hashtags: list[str]
    news_results: list[dict]


@router.post("/generate", response_model=GenerateResponse)
def generate_post(payload: GenerateRequest):
    query = payload.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    news_results = fetch_google_news_light(query)

    if not news_results:
        raise HTTPException(status_code=422, detail="No news found for this query")

    try:
        copy = generate_post_copy(query, news_results)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"LLM generation failed: {str(e)}")

    return GenerateResponse(
        headline=copy["headline"],
        description=copy["description"],
        story_description=copy["story_description"],
        hashtags=copy["hashtags"],
        news_results=news_results,
    )


# ---------- History: save / list / fetch (unchanged) ----------

class HistorySaveRequest(BaseModel):
    user_id: int
    query: str
    headline: str
    description: str | None = None
    story_description: str | None = None
    hashtags: list[str] = []
    news_results: list[dict] = []
    settings_snapshot: dict | None = None


class HistoryResponse(BaseModel):
    id: int
    user_id: int
    query: str
    headline: str | None
    description: str | None
    story_description: str | None
    hashtags: list[str]
    news_results: list[dict]
    settings_snapshot: dict | None
    media_filename: str | None
    publish_status: str
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.post("/history", response_model=HistoryResponse)
def save_history(payload: HistorySaveRequest, db: Session = Depends(get_db)):
    entry = SocialPostHistory(
        user_id=payload.user_id,
        query=payload.query,
        headline=payload.headline,
        description=payload.description,
        story_description=payload.story_description,
        hashtags=payload.hashtags,
        news_results=payload.news_results,
        settings_snapshot=payload.settings_snapshot,
        publish_status="draft",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/history", response_model=list[HistoryResponse])
def list_history(user_id: int, db: Session = Depends(get_db)):
    entries = (
        db.query(SocialPostHistory)
        .filter(SocialPostHistory.user_id == user_id)
        .order_by(SocialPostHistory.created_at.desc())
        .all()
    )
    return entries


@router.get("/history/{history_id}", response_model=HistoryResponse)
def get_history(history_id: int, db: Session = Depends(get_db)):
    entry = db.query(SocialPostHistory).filter(SocialPostHistory.id == history_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")
    return entry


# ---------- History: media upload (unchanged) ----------

@router.post("/history/{history_id}/media", response_model=HistoryResponse)
async def upload_media(
    history_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    entry = db.query(SocialPostHistory).filter(SocialPostHistory.id == history_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only PNG files are allowed")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    filename = f"{history_id}_{uuid.uuid4().hex}.png"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    if entry.media_filename:
        old_path = os.path.join(UPLOAD_DIR, entry.media_filename)
        if os.path.exists(old_path):
            os.remove(old_path)

    entry.media_filename = filename
    entry.publish_status = "media_ready"
    db.commit()
    db.refresh(entry)
    return entry


# ---------- Publish ----------

class PublishRequest(BaseModel):
    user_id: int
    platforms: list[str] = ["facebook"]  # only facebook supported right now


class PublicationResult(BaseModel):
    platform: str
    status: str
    external_id: str | None
    external_url: str | None
    error: str | None


class PublishResponse(BaseModel):
    history_id: int
    publish_status: str
    results: list[PublicationResult]


@router.post("/history/{history_id}/publish", response_model=PublishResponse)
def publish_post(history_id: int, payload: PublishRequest, db: Session = Depends(get_db)):
    entry = db.query(SocialPostHistory).filter(SocialPostHistory.id == history_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")

    if not entry.media_filename:
        raise HTTPException(status_code=400, detail="No media attached to this post yet — upload an image first")

    image_path = os.path.join(UPLOAD_DIR, entry.media_filename)

    # Build the caption: headline + story description, per platform copy convention
    caption_parts = [p for p in [entry.headline, entry.story_description] if p]
    caption = "\n\n".join(caption_parts)
    if entry.hashtags:
        caption += "\n\n" + " ".join(f"#{tag.replace(' ', '')}" for tag in entry.hashtags)

    results = []
    any_success = False
    any_failure = False

    for platform in payload.platforms:
        if platform != "facebook":
            results.append(PublicationResult(
                platform=platform, status="failed", external_id=None, external_url=None,
                error="Only Facebook publishing is implemented right now",
            ))
            any_failure = True
            continue

        account = (
            db.query(SocialAccount)
            .filter(
                SocialAccount.user_id == payload.user_id,
                SocialAccount.platform == "facebook",
            )
            .first()
        )

        if not account:
            results.append(PublicationResult(
                platform="facebook", status="failed", external_id=None, external_url=None,
                error="No connected Facebook account found for this user",
            ))
            any_failure = True
        else:
            outcome = publish_photo_to_facebook_page(
                page_id=account.platform_account_id,
                page_access_token=account.access_token,
                image_path=image_path,
                caption=caption,
            )
            status = "success" if outcome["success"] else "failed"
            results.append(PublicationResult(
                platform="facebook",
                status=status,
                external_id=outcome["external_id"],
                external_url=outcome["external_url"],
                error=outcome["error"],
            ))
            any_success = any_success or outcome["success"]
            any_failure = any_failure or not outcome["success"]

        # Record this attempt in social_post_publications regardless of outcome
        db.add(SocialPostPublication(
            history_id=history_id,
            platform=results[-1].platform,
            status=results[-1].status,
            external_id=results[-1].external_id,
            external_url=results[-1].external_url,
            error=results[-1].error,
        ))

    # Finalize history status
    if any_success and not any_failure:
        entry.publish_status = "published"
        entry.published_at = datetime.now(timezone.utc)
    elif any_success and any_failure:
        entry.publish_status = "partial"
        entry.published_at = datetime.now(timezone.utc)
    else:
        entry.publish_status = "failed"

    db.commit()

    return PublishResponse(
        history_id=history_id,
        publish_status=entry.publish_status,
        results=results,
    )