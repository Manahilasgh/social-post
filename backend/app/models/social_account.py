from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class SocialAccount(Base):
    __tablename__ = "social_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    platform = Column(String, nullable=False)          # e.g. "facebook"
    platform_account_id = Column(String, nullable=False)  # Facebook Page ID
    display_name = Column(String, nullable=True)        # Page name, for UI display

    access_token = Column(Text, nullable=False)         # Page access token (should be encrypted at rest later)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())