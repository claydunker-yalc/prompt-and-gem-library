from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def insert_item(item_data: dict) -> dict:
    """Insert a new item into the database."""
    result = supabase.table("items").insert(item_data).execute()
    return result.data[0]


def get_all_items(item_type: str | None = None, limit: int = 50, offset: int = 0) -> list[dict]:
    """Get all items, optionally filtered by type."""
    query = (
        supabase.table("items")
        .select("id, item_type, title, description, url, prompt_text, framework_breakdown, created_at")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if item_type:
        query = query.eq("item_type", item_type)
    return query.execute().data


def get_item_by_id(item_id: str) -> dict | None:
    """Get a single item by ID."""
    result = supabase.table("items").select("*").eq("id", item_id).execute()
    return result.data[0] if result.data else None


def delete_item(item_id: str) -> bool:
    """Delete an item by ID."""
    result = supabase.table("items").delete().eq("id", item_id).execute()
    return len(result.data) > 0 if result.data else False


def update_item(item_id: str, updates: dict) -> dict | None:
    """Update an item by ID."""
    result = supabase.table("items").update(updates).eq("id", item_id).execute()
    return result.data[0] if result.data else None


def search_by_embedding(
    query_embedding: list[float],
    limit: int = 10,
    item_type: str | None = None
) -> list[dict]:
    """Search items by semantic similarity using RPC function."""
    result = supabase.rpc(
        "search_items",
        {
            "query_embedding": query_embedding,
            "match_count": limit,
            "filter_type": item_type
        }
    ).execute()
    return result.data


def get_item_count(item_type: str | None = None) -> int:
    """Get total count of items, optionally filtered by type."""
    query = supabase.table("items").select("id", count="exact")
    if item_type:
        query = query.eq("item_type", item_type)
    result = query.execute()
    return result.count or 0
