import { Elysia, t } from "elysia";
import { getRequirements } from "./purchasing.service";
import { authGuard } from "../../middlewares/auth";
import { rateLimitMiddleware } from "../../middlewares/rateLimit";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	UnauthorizedError,
} from "../../middlewares/error";
import type { DateRange } from "./purchasing.schema";

/**
 * Parse repeated ?dateRange=start,end query params into DateRange[].
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

export const purchasingRoutes = new Elysia({ prefix: "/purchasing" })
	.use(rateLimitMiddleware())
	.use(authGuard)
	.use(caslMiddleware)

	/**
	 * GET /purchasing/requirements
	 *
	 * Compute purchase requirements based on sales history and inventory levels.
	 *
	 * Query params:
	 *   classID    (required) — Principal ClassID filter
	 *   siteID     (repeatable) — Inventory SiteID filter
	 *   dateRange  (repeatable) — "YYYY-MM-DD,YYYY-MM-DD"
	 *   frequency  (required) — "monthly" | "weekly"
	 */
	.get(
		"/requirements",
		async ({ query, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Sales");

			if (!query.classID) {
				throw new BadRequestError("classID is required");
			}
			if (!query.frequency || !["monthly", "weekly"].includes(query.frequency)) {
				throw new BadRequestError("frequency must be 'monthly' or 'weekly'");
			}

			const dateRanges = parseDateRanges(query.dateRange);
			if (dateRanges.length === 0) {
				throw new BadRequestError(
					"At least one dateRange is required (format: YYYY-MM-DD,YYYY-MM-DD)",
				);
			}

			const siteIDs = query.siteID
				? Array.isArray(query.siteID)
					? query.siteID
					: [query.siteID]
				: undefined;

			return getRequirements({
				classID: query.classID,
				siteID: siteIDs,
				dateRanges,
				frequency: query.frequency as "weekly" | "monthly",
			});
		},
		{
			query: t.Object({
				classID: t.String(),
				siteID: t.Optional(
					t.Union([t.String(), t.Array(t.String())]),
				),
				dateRange: t.Optional(
					t.Union([t.String(), t.Array(t.String())]),
				),
				frequency: t.String(),
			}),
		},
	);
