from sqlalchemy import Column, Integer, JSON, ForeignKey
from app.database import Base


class SocialPostTemplatePrefs(Base):
    __tablename__ = "social_post_template_prefs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)

    store = Column(JSON, default=dict)  # brand preset store: {presets: [...], activePresetId: ...}