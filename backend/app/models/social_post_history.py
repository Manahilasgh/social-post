from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class SocialPostHistory(Base):
    __tablename__ = "social_post_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    query = Column(String, nullable=False)
    headline = Column(Text)
    description = Column(Text)
    story_description = Column(Text)
    hashtags = Column(JSON, default=list)  # string[]

    settings_snapshot = Column(JSON)  # SocialPostTemplateSettings at save time
    news_results = Column(JSON)       # array of news items

    media_filename = Column(String, nullable=True)  # PNG in uploads/social/
    publish_status = Column(String, default="draft")  # draft/media_ready/publishing/published/partial/failed

    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())