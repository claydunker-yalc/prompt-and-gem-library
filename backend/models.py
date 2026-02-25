from datetime import datetime
from pydantic import BaseModel, HttpUrl


# === CREATE MODELS ===

class GemCreate(BaseModel):
    """Request model for creating a new Gemini Gem."""
    url: HttpUrl
    title: str
    description: str | None = None


class PromptCreate(BaseModel):
    """Request model for creating a new prompt."""
    prompt_text: str
    title: str | None = None  # Optional - will auto-generate if not provided


class LetterMeaning(BaseModel):
    """A single letter and its meaning in a framework."""
    letter: str
    meaning: str


class FrameworkCreate(BaseModel):
    """Request model for creating a new prompt framework."""
    name: str  # e.g., "RICCE"
    description: str | None = None  # What this framework is for
    breakdown: list[LetterMeaning]  # e.g., [{"letter": "R", "meaning": "Role"}, ...]


# === RESPONSE MODELS ===

class ItemResponse(BaseModel):
    """Response model for a single item."""
    id: str
    item_type: str  # 'gem', 'prompt', or 'framework'
    title: str
    description: str | None
    url: str | None  # Only for gems
    prompt_text: str | None  # Only for prompts
    framework_breakdown: list | None  # Only for frameworks - list of {letter, meaning}
    created_at: datetime


class ItemUpdate(BaseModel):
    """Request model for updating an item."""
    title: str | None = None
    description: str | None = None


class SearchRequest(BaseModel):
    """Request model for semantic search."""
    query: str
    limit: int = 10
    item_type: str | None = None  # Optional filter: 'gem', 'prompt', or 'framework'


class SearchResult(ItemResponse):
    """Response model for a search result (includes similarity score)."""
    similarity: float
