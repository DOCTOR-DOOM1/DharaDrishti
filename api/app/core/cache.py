"""Redis client for caching."""

import redis.asyncio as aioredis
import json
from app.core.config import get_settings


_pool = None


async def get_redis() -> aioredis.Redis:
    """Get or create the async Redis connection pool."""
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _pool


def _cache_key(city: str, version: int, endpoint: str, params: str = "") -> str:
    """Build a versioned cache key — invalidated when product version changes."""
    return f"dd:{city}:v{version}:{endpoint}:{params}"


async def cache_get(city: str, version: int, endpoint: str, params: str = ""):
    """Get a cached value, or None."""
    r = await get_redis()
    key = _cache_key(city, version, endpoint, params)
    val = await r.get(key)
    if val:
        return json.loads(val)
    return None


async def cache_set(
    city: str, version: int, endpoint: str, data: dict | list,
    params: str = "", ttl: int = 3600
):
    """Cache a value with TTL."""
    r = await get_redis()
    key = _cache_key(city, version, endpoint, params)
    await r.setex(key, ttl, json.dumps(data))


async def cache_invalidate(city: str, version: int):
    """Invalidate all cache entries for a city+version."""
    r = await get_redis()
    pattern = f"dd:{city}:v{version}:*"
    async for key in r.scan_iter(match=pattern):
        await r.delete(key)
