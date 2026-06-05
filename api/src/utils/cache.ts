/**
 * In-memory TTL cache for reference/lookup data.
 *
 * Reference data (sites, price classes, principals) changes rarely
 * but is queried on every page mount. This cache stores results in
 * memory with a configurable TTL, reducing DB load.
 *
 * Cache is automatically invalidated when write operations occur
 * (POST/PUT/DELETE on the same entity).
 */

interface CacheEntry<T> {
	data: T;
	expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Retrieve cached data or fetch + cache it.
 *
 * @param key       Unique cache key (use namespace like `"entity:operation"`)
 * @param ttlMs     Time-to-live in milliseconds
 * @param fetcher   Async function that fetches fresh data
 */
export async function withCache<T>(
	key: string,
	ttlMs: number,
	fetcher: () => Promise<T>,
): Promise<T> {
	const now = Date.now();
	const existing = store.get(key);

	if (existing && existing.expiresAt > now) {
		return existing.data as T;
	}

	const data = await fetcher();
	store.set(key, { data, expiresAt: now + ttlMs });
	return data;
}

/**
 * Invalidate a specific cache entry.
 */
function invalidateCache(key: string): void {
	store.delete(key);
}

/**
 * Invalidate all cache entries whose key starts with the given prefix.
 * Useful when a write operation affects a whole entity type.
 *
 * @example invalidateCachePrefix("inventory:") // clears inventory:all
 */
export function invalidateCachePrefix(prefix: string): void {
	for (const key of store.keys()) {
		if (key.startsWith(prefix)) {
			store.delete(key);
		}
	}
}

/**
 * Check if a specific cache key has valid (non-expired) data.
 *
 * @returns true if an unexpired entry exists for the given key
 */
function isCached(key: string): boolean {
	const entry = store.get(key);
	return entry !== undefined && entry.expiresAt > Date.now();
}

/**
 * Check if any cache key starting with the given prefix has valid data.
 *
 * @example isCachedPrefix("inventory:") // checks inventory:all, etc.
 */
function isCachedPrefix(prefix: string): boolean {
	for (const [key, entry] of store) {
		if (key.startsWith(prefix) && entry.expiresAt > Date.now()) {
			return true;
		}
	}
	return false;
}

/**
 * Clear the entire cache. Useful in testing or admin reset.
 */
function clearAllCache(): void {
	store.clear();
}
