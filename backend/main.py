from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from enum import Enum

from models import (
    GemCreate, PromptCreate, FrameworkCreate,
    ItemResponse, ItemUpdate, SearchRequest, SearchResult
)
from database import (
    insert_item, get_all_items, get_item_by_id,
    delete_item, update_item, search_by_embedding, get_item_count
)
from services import generate_embedding, generate_prompt_description


app = FastAPI(
    title="Prompt and Gem Library API",
    description="Store and semantically search prompts, gems, and frameworks",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ItemType(str, Enum):
    gem = "gem"
    prompt = "prompt"
    framework = "framework"


@app.get("/")
async def root():
    """API info endpoint."""
    return {
        "message": "Prompt and Gem Library API",
        "version": "1.0.0",
        "endpoints": {
            "POST /items/gem": "Add a Gemini Gem",
            "POST /items/prompt": "Add a prompt",
            "POST /items/framework": "Add a prompt framework",
            "GET /items": "List all items",
            "GET /items/{id}": "Get single item",
            "DELETE /items/{id}": "Delete item",
            "POST /search": "Semantic search"
        }
    }


@app.post("/items/gem", response_model=ItemResponse)
async def add_gem(gem: GemCreate):
    """Add a Gemini Gem link with URL, title, and description."""
    # Generate embedding from title + description
    text_for_embedding = f"{gem.title} {gem.description or ''}"
    embedding = generate_embedding(text_for_embedding)

    item_data = {
        "item_type": "gem",
        "title": gem.title,
        "description": gem.description,
        "url": str(gem.url),
        "embedding": embedding
    }

    saved = insert_item(item_data)

    return ItemResponse(
        id=saved["id"],
        item_type=saved["item_type"],
        title=saved["title"],
        description=saved.get("description"),
        url=saved.get("url"),
        prompt_text=None,
        framework_breakdown=None,
        created_at=saved["created_at"]
    )


@app.post("/items/prompt", response_model=ItemResponse)
async def add_prompt(prompt: PromptCreate):
    """Add a prompt with AI-generated description."""
    # Generate description using Claude
    description = generate_prompt_description(prompt.prompt_text)

    # Generate title from first line or truncated prompt if not provided
    if prompt.title:
        title = prompt.title
    else:
        first_line = prompt.prompt_text.split('\n')[0][:50]
        title = first_line + ("..." if len(prompt.prompt_text) > 50 else "")

    # Generate embedding from prompt text + description
    text_for_embedding = f"{prompt.prompt_text} {description}"
    embedding = generate_embedding(text_for_embedding)

    item_data = {
        "item_type": "prompt",
        "title": title,
        "description": description,
        "prompt_text": prompt.prompt_text,
        "embedding": embedding
    }

    saved = insert_item(item_data)

    return ItemResponse(
        id=saved["id"],
        item_type=saved["item_type"],
        title=saved["title"],
        description=saved.get("description"),
        url=None,
        prompt_text=saved.get("prompt_text"),
        framework_breakdown=None,
        created_at=saved["created_at"]
    )


@app.post("/items/framework", response_model=ItemResponse)
async def add_framework(framework: FrameworkCreate):
    """Add a prompt framework with structured breakdown."""
    # Convert breakdown to list of dicts for storage
    breakdown_list = [{"letter": item.letter, "meaning": item.meaning} for item in framework.breakdown]

    # Generate embedding from name + description + breakdown values
    breakdown_text = " ".join(f"{item.letter}: {item.meaning}" for item in framework.breakdown)
    text_for_embedding = f"{framework.name} {framework.description or ''} {breakdown_text}"
    embedding = generate_embedding(text_for_embedding)

    item_data = {
        "item_type": "framework",
        "title": framework.name,
        "description": framework.description,
        "framework_breakdown": breakdown_list,
        "embedding": embedding
    }

    saved = insert_item(item_data)

    return ItemResponse(
        id=saved["id"],
        item_type=saved["item_type"],
        title=saved["title"],
        description=saved.get("description"),
        url=None,
        prompt_text=None,
        framework_breakdown=saved.get("framework_breakdown"),
        created_at=saved["created_at"]
    )


@app.get("/items", response_model=list[ItemResponse])
async def list_items(
    type: ItemType | None = Query(None, description="Filter by item type"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """List all items, optionally filtered by type."""
    items = get_all_items(item_type=type.value if type else None, limit=limit, offset=offset)

    return [
        ItemResponse(
            id=item["id"],
            item_type=item["item_type"],
            title=item["title"],
            description=item.get("description"),
            url=item.get("url"),
            prompt_text=item.get("prompt_text"),
            framework_breakdown=item.get("framework_breakdown"),
            created_at=item["created_at"]
        )
        for item in items
    ]


@app.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str):
    """Get a single item by ID."""
    item = get_item_by_id(item_id)

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    return ItemResponse(
        id=item["id"],
        item_type=item["item_type"],
        title=item["title"],
        description=item.get("description"),
        url=item.get("url"),
        prompt_text=item.get("prompt_text"),
        framework_breakdown=item.get("framework_breakdown"),
        created_at=item["created_at"]
    )


@app.delete("/items/{item_id}")
async def remove_item(item_id: str):
    """Delete an item."""
    item = get_item_by_id(item_id)

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    delete_item(item_id)

    return {"message": "Item deleted", "id": item_id}


@app.patch("/items/{item_id}", response_model=ItemResponse)
async def edit_item(item_id: str, updates: ItemUpdate):
    """Update an item's title or description."""
    item = get_item_by_id(item_id)

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Build update dict with only provided fields
    update_data = {}
    if updates.title is not None:
        update_data["title"] = updates.title
    if updates.description is not None:
        update_data["description"] = updates.description

    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")

    updated = update_item(item_id, update_data)

    return ItemResponse(
        id=updated["id"],
        item_type=updated["item_type"],
        title=updated["title"],
        description=updated.get("description"),
        url=updated.get("url"),
        prompt_text=updated.get("prompt_text"),
        framework_breakdown=updated.get("framework_breakdown"),
        created_at=updated["created_at"]
    )


@app.post("/search", response_model=list[SearchResult])
async def search_items(request: SearchRequest):
    """Semantic search across all items or filtered by type."""
    query_embedding = generate_embedding(request.query)

    results = search_by_embedding(
        query_embedding,
        limit=request.limit,
        item_type=request.item_type
    )

    return [
        SearchResult(
            id=r["id"],
            item_type=r["item_type"],
            title=r["title"],
            description=r.get("description"),
            url=r.get("url"),
            prompt_text=r.get("prompt_text"),
            framework_breakdown=r.get("framework_breakdown"),
            created_at=r["created_at"],
            similarity=r["similarity"]
        )
        for r in results
    ]


@app.get("/stats")
async def get_stats():
    """Get library statistics."""
    return {
        "total_items": get_item_count(),
        "gems": get_item_count("gem"),
        "prompts": get_item_count("prompt"),
        "frameworks": get_item_count("framework")
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
