import { Elysia, t } from "elysia";
import { getSales, MAX_LIMIT, DEFAULT_LIMIT } from "./sales.service";
import { authGuard } from "../../middlewares/auth";
import { rateLimitMiddleware } from "../../middlewares/rateLimit";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	UnauthorizedError,
} from "../../middlewares/error";
import type { DateRange } from "./sales.schema";

/**
 * Parse repeated ?dateRange=start,end query params into DateRange[].
 * Example: ?dateRange=2026-01-01,2026-02-26&dateRange=2026-04-03,2026-06-12
 */
function parseDateRanges(raw: unknown): DateRange[] {
	if (raw === undefined || raw === null) return [];

	const items = Array.isArray(raw) ? raw : [raw];

	return items
		.map((v: unknown) => {
			if (typeof v !== "string") return null;
			const parts = v.split(",");
			if (parts.length !== 2) return null;
			const start = (parts[0] ?? "").trim();
			const end = (parts[1] ?? "").trim();
			if (!start || !end) return null;

			const dateRe = /^\d{4}-\d{2}-\d{2}$/;
			if (!dateRe.test(start) || !dateRe.test(end)) return null;

			return { start, end } as DateRange;
		})
		.filter((d): d is DateRange => d !== null);
}

function clamp(val: number, min: number, max: number): number {
	return Math.min(Math.max(val, min), max);
}

export const salesRoutes = new Elysia({ prefix: "/sales" })
	.use(rateLimitMiddleware)
	.use(authGuard)
	.use(caslMiddleware)

	/**
	 * GET /sales
	 *
	 * Paginated sales data with optional date-range and field filtering.
	 *
	 * Query params:
	 *   page       (number, default 1)
	 *   limit      (number, default 500, max 10000)
	 *   dateRange  (repeatable) — "YYYY-MM-DD,YYYY-MM-DD"
	 *   siteID     (string, optional) — filter by SiteID
	 *   priceClassID (string, optional) — filter by PriceClassID
	 *   classID    (string, optional) — filter by ClassID
	 *
	 * Examples:
	 *   GET /sales
	 *   GET /sales?page=1&limit=200
	 *   GET /sales?dateRange=2026-01-01,2026-02-26&page=1&limit=500
	 *   GET /sales?dateRange=2026-01-01,2026-02-26&dateRange=2026-04-03,2026-06-12
	 *   GET /sales?siteID=MAIN&classID=ABC
	 *   GET /sales?priceClassID=WHOLESALE&page=1&limit=100
	 */
	.get(
		"/",
		async ({ query, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Sales");

			const page = clamp(Number(query.page) || 1, 1, Infinity);
			const limit = clamp(Number(query.limit) || DEFAULT_LIMIT, 1, MAX_LIMIT);
			const dateRanges = parseDateRanges(query.dateRange);
			const siteIDs = query.siteID
				? Array.isArray(query.siteID)
					? query.siteID
					: [query.siteID]
				: undefined;

			return getSales(
				page,
				limit,
				dateRanges.length > 0 ? dateRanges : undefined,
				{
					siteID: siteIDs,
					priceClassID: query.priceClassID || undefined,
					classID: query.classID || undefined,
				},
			);
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
				dateRange: t.Optional(
					t.Union([t.String(), t.Array(t.String())]),
				),
				siteID: t.Optional(
					t.Union([t.String(), t.Array(t.String())]),
				),
				priceClassID: t.Optional(t.String()),
				classID: t.Optional(t.String()),
			}),
		},
	);
