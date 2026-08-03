from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
import os
import requests

from app.database import get_db
from app.models.social_account import SocialAccount

router = APIRouter(prefix="/api/social-accounts", tags=["social-accounts"])

FB_APP_ID = os.getenv("FACEBOOK_APP_ID")
FB_APP_SECRET = os.getenv("FACEBOOK_APP_SECRET")
FB_REDIRECT_URI = os.getenv("FACEBOOK_REDIRECT_URI", "http://localhost:8000/api/social-accounts/facebook/callback")
FB_API_VERSION = "v21.0"

FB_OAUTH_DIALOG_URL = f"https://www.facebook.com/{FB_API_VERSION}/dialog/oauth"
FB_GRAPH_URL = f"https://graph.facebook.com/{FB_API_VERSION}"

FB_SCOPES = "pages_show_list,pages_manage_posts,pages_read_engagement"


# ---------- List connected accounts (NEW) ----------

class SocialAccountResponse(BaseModel):
    id: int
    platform: str
    platform_account_id: str
    display_name: str | None

    class Config:
        from_attributes = True


@router.get("", response_model=list[SocialAccountResponse])
def list_social_accounts(user_id: int = Query(...), db: Session = Depends(get_db)):
    """
    Returns all connected accounts for a user, across all platforms.
    Frontend uses this to show 'Connected' vs 'Connect' state per platform.
    Never returns access_token — this is a public-safe summary only.
    """
    accounts = (
        db.query(SocialAccount)
        .filter(SocialAccount.user_id == user_id)
        .all()
    )
    return accounts


# ---------- Facebook OAuth: connect (unchanged) ----------

@router.get("/facebook/connect")
def facebook_connect(user_id: int = Query(...)):
    if not FB_APP_ID:
        raise HTTPException(status_code=500, detail="FACEBOOK_APP_ID is not configured")

    params = {
        "client_id": FB_APP_ID,
        "redirect_uri": FB_REDIRECT_URI,
        "scope": FB_SCOPES,
        "state": str(user_id),
        "response_type": "code",
    }
    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=f"{FB_OAUTH_DIALOG_URL}?{query_string}")


# ---------- Facebook OAuth: callback (unchanged) ----------

@router.get("/facebook/callback")
def facebook_callback(code: str = Query(...), state: str = Query(...), db: Session = Depends(get_db)):
    if not FB_APP_ID or not FB_APP_SECRET:
        raise HTTPException(status_code=500, detail="Facebook app credentials not configured")

    user_id = int(state)

    token_resp = requests.get(
        f"{FB_GRAPH_URL}/oauth/access_token",
        params={
            "client_id": FB_APP_ID,
            "redirect_uri": FB_REDIRECT_URI,
            "client_secret": FB_APP_SECRET,
            "code": code,
        },
        timeout=15,
    )
    if not token_resp.ok:
        raise HTTPException(status_code=502, detail=f"Facebook token exchange failed: {token_resp.text}")

    short_lived_token = token_resp.json().get("access_token")

    long_lived_resp = requests.get(
        f"{FB_GRAPH_URL}/oauth/access_token",
        params={
            "grant_type": "fb_exchange_token",
            "client_id": FB_APP_ID,
            "client_secret": FB_APP_SECRET,
            "fb_exchange_token": short_lived_token,
        },
        timeout=15,
    )
    if not long_lived_resp.ok:
        raise HTTPException(status_code=502, detail=f"Facebook long-lived token exchange failed: {long_lived_resp.text}")

    long_lived_user_token = long_lived_resp.json().get("access_token")

    pages_resp = requests.get(
        f"{FB_GRAPH_URL}/me/accounts",
        params={"access_token": long_lived_user_token},
        timeout=15,
    )
    if not pages_resp.ok:
        raise HTTPException(status_code=502, detail=f"Failed to fetch Facebook Pages: {pages_resp.text}")

    pages = pages_resp.json().get("data", [])
    if not pages:
        raise HTTPException(
            status_code=422,
            detail="No Facebook Pages found for this account. You need to be an admin of at least one Page.",
        )

    saved_pages = []
    for page in pages:
        page_id = page["id"]
        page_token = page["access_token"]
        page_name = page.get("name")

        existing = (
            db.query(SocialAccount)
            .filter(
                SocialAccount.user_id == user_id,
                SocialAccount.platform == "facebook",
                SocialAccount.platform_account_id == page_id,
            )
            .first()
        )

        if existing:
            existing.access_token = page_token
            existing.display_name = page_name
        else:
            existing = SocialAccount(
                user_id=user_id,
                platform="facebook",
                platform_account_id=page_id,
                display_name=page_name,
                access_token=page_token,
            )
            db.add(existing)

        saved_pages.append({"page_id": page_id, "name": page_name})

    db.commit()

    return {"connected_pages": saved_pages}