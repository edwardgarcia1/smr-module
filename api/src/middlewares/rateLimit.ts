import { Elysia } from "elysia";
import { isCached } from "../utils/cache";

interface RateLimitEntry {
	count: number;
	resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const WINDOW_MS = 1 * 60 * 1000; // 1 minute
const MAX_REQUESTS = 120; // 120 requests per window

/**
 * Rate-limit middleware factory.
 *
 * Pass one or more **exact cache keys** (from `cache.ts`) to make the
 * rate limiter skip counting when any of those keys have valid (hot)
 * cached data.  This is designed for reference/lookup GET endpoints
 * whose data changes rarely.
 *
 * @example
 *   // No cache awareness (default)
 *   .use(rateLimitMiddleware())
 *
 *   // Skip rate limit when `lookups:all` is in cache
 *   .use(rateLimitMiddleware("lookups:all"))
 */
export const rateLimitMiddleware = (...cacheKeys: string[]) => {
	const hasCacheKeys = cacheKeys.length > 0;

	return (app: Elysia) =>
		app.derive({ as: "global" }, async (ctx) => {
			// ── Bypass when cache is hot ──────────────────────────────
			if (hasCacheKeys) {
				for (const key of cacheKeys) {
					if (isCached(key)) {
						return {
							rateLimit: {
								remaining: MAX_REQUESTS,
								reset: Date.now() + WINDOW_MS,
							},
							limited: false,
						};
					}
				}
			}

			// ── Normal rate-limit logic ──────────────────────────────
			const ip =
				ctx.headers["x-forwarded-for"] ||
				ctx.headers["x-real-ip"] ||
				"unknown";
			const key = `${ip}`;

			const now = Date.now();
			const entry = rateLimitMap.get(key);

			if (!entry || now > entry.resetTime) {
				rateLimitMap.set(key, { count: 1, resetTime: now + WINDOW_MS });
				return {
					rateLimit: {
						remaining: MAX_REQUESTS - 1,
						reset: now + WINDOW_MS,
					},
				};
			}

			if (entry.count >= MAX_REQUESTS) {
				return {
					rateLimit: { remaining: 0, reset: entry.resetTime },
					limited: true,
				};
			}

			entry.count++;
			return {
				rateLimit: {
					remaining: MAX_REQUESTS - entry.count,
					reset: entry.resetTime,
				},
			};
		});
};
