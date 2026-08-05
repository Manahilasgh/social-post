from dotenv import load_dotenv

load_dotenv()


import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.social_post import router as social_post_router
from app.api.social_accounts import router as social_accounts_router
from app.api.images import router as images_router
from fastapi.staticfiles import StaticFiles
from app.api.auth import router as auth_router


app = FastAPI(title="Social Post API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://social-post-sage.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(social_post_router)
app.include_router(social_accounts_router)
app.include_router(images_router)
app.include_router(auth_router)


@app.get("/health")
def health():
    return {"status": "ok"}


# Serve uploaded card images.
# Must come AFTER route registrations — StaticFiles mount is a catch-all.
# GET http://localhost:8000/uploads/social/<filename>
os.makedirs(os.path.join("uploads", "social"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
