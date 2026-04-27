import { Elysia } from "elysia";

interface RateLimitEntry {
	count: number;
	resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const WINDOW_MS = 1 * 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per window

export const rateLimitMiddleware = (app: Elysia) =>
	app.derive({ as: "global" }, async (ctx) => {
		const ip =
			ctx.headers["x-forwarded-for"] || ctx.headers["x-real-ip"] || "unknown";
		const key = `${ip}`;

		const now = Date.now();
		const entry = rateLimitMap.get(key);

		if (!entry || now > entry.resetTime) {
			rateLimitMap.set(key, { count: 1, resetTime: now + WINDOW_MS });
			return {
				rateLimit: { remaining: MAX_REQUESTS - 1, reset: now + WINDOW_MS },
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
