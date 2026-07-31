from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class SocialPostPublication(Base):
    __tablename__ = "social_post_publications"

    id = Column(Integer, primary_key=True, index=True)
    history_id = Column(Integer, ForeignKey("social_post_history.id"), nullable=False, index=True)

    platform = Column(String, nullable=False)   # e.g. "x", "pinterest", "facebook"
    status = Column(String, nullable=False)     # "success" or "failed"
    external_id = Column(String, nullable=True)  # platform post ID
    external_url = Column(String, nullable=True)  # link to live post
    error = Column(Text, nullable=True)          # failure message

    published_at = Column(DateTime(timezone=True), server_default=func.now())