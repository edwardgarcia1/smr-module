import { Elysia, t } from "elysia";
import { getBundlingRequirements } from "./bundling.service";
import { authGuard } from "../../middlewares/auth";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	UnauthorizedError,
} from "../../middlewares/error";
import type { DateRange } from "./bundling.schema";

/**
 * Parse a single ?dateRange=start,end query param into a DateRange.
 */
function parseDateRange(raw: unknown): DateRange | null {
	if (typeof raw !== "string") return null;
	const parts = raw.split(",");
	if (parts.length !== 2) return null;
	const start = (parts[0] ?? "").trim();
	const end = (parts[1] ?? "").trim();
	if (!start || !end) return null;

	const dateRe = /^\d{4}-\d{2}-\d{2}$/;
	if (!dateRe.test(start) || !dateRe.test(end)) return null;

	return { start, end } as DateRange;
}

export const bundlingRoutes = new Elysia({ prefix: "/bundling" })
	.use(authGuard)
	.use(caslMiddleware)

	/**
	 * GET /bundling/requirements
	 *
	 * Compute bundling requirements for promo/kit items.
	 * Only returns items that have Component entries (promos/kits).
	 * For each promo, shows component stock levels and whether bundling
	 * from existing components can fulfill demand instead of purchasing.
	 *
	 * Query params:
	 *   classID         (required) — Principal ClassID filter
	 *   siteID          (repeatable) — Inventory SiteID filter
	 *   dateRange       (required) — "YYYY-MM-DD,YYYY-MM-DD"
	 *   frequency       (required) — "monthly" | "weekly"
	 *   validDays       (optional) — Total valid working days across all months (weekly mode only)
	 *   monthlyValidDays (optional) — JSON string of per-month valid days (weekly mode only)
	 */
	.get(
		"/requirements",
		async ({ query, ability, user }) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Requirements");

			if (!query.classID) {
				throw new BadRequestError("classID is required");
			}
			if (!query.frequency || !["monthly", "weekly"].includes(query.frequency)) {
				throw new BadRequestError("frequency must be 'monthly' or 'weekly'");
			}

			const dateRange = parseDateRange(query.dateRange);
			if (!dateRange) {
				throw new BadRequestError(
					"dateRange is required (format: YYYY-MM-DD,YYYY-MM-DD)",
				);
			}

			const siteIDs = query.siteID
				? Array.isArray(query.siteID)
					? query.siteID
					: [query.siteID]
				: undefined;

			const validDays = query.validDays !== undefined
				? Number(query.validDays)
				: undefined;
			const monthlyValidDays = query.monthlyValidDays !== undefined
				? String(query.monthlyValidDays)
				: undefined;

			const demandSource = query.demandSource !== undefined
				? (query.demandSource as "shipped" | "ordered")
				: undefined;

			return getBundlingRequirements({
				classID: query.classID,
				siteID: siteIDs,
				dateRange,
				frequency: query.frequency as "weekly" | "monthly",
				validDays,
				monthlyValidDays,
				demandSource,
			}, user.tenant);
		},
		{
			query: t.Object({
				classID: t.String(),
				siteID: t.Optional(
					t.Union([t.String(), t.Array(t.String())]),
				),
				dateRange: t.String(),
				frequency: t.String(),
				validDays: t.Optional(t.String()),
				monthlyValidDays: t.Optional(t.String()),
				demandSource: t.Optional(t.String()),
			}),
		},
	);
