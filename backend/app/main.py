from dotenv import load_dotenv

load_dotenv()
from fastapi import FastAPI
from app.api.social_post import router as social_post_router
from app.api.social_accounts import router as social_accounts_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Social Post API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(social_post_router)
app.include_router(social_accounts_router)
@app.get("/health")

def health():
    return {"status": "ok"}