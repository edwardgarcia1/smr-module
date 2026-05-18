import { Elysia, t } from "elysia";
import { createItemCost,
	getItemCostById,
	expireItemCost,
	deleteItemCost,
	importItemCosts,
	createPriceClass,
	getCurrentPriceClasses,
	getDistinctPriceClasses,
	updatePriceClass,
	deletePriceClass,
	getPricesPaginated,
	MAX_LIMIT,
	DEFAULT_LIMIT,
} from "./price.service";
import { authGuard } from "../../middlewares/auth";
import { rateLimitMiddleware } from "../../middlewares/rateLimit";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	NotFoundError,
	UnauthorizedError,
} from "../../middlewares/error";
import { withCache, invalidateCachePrefix } from "../../utils/cache";

/** Cache TTL for reference data: 5 minutes */
const REF_CACHE_TTL = 5 * 60 * 1000;
const CACHE_PREFIX = "price:";

function clamp(val: number, min: number, max: number): number {
	return Math.min(Math.max(val, min), max);
}

export const priceRoutes = new Elysia({ prefix: "/price" })

	// ── Cached endpoint ────────────────────────────────────────────
	.use(
		new Elysia()
			.use(authGuard)
			.use(caslMiddleware)
			.use(rateLimitMiddleware(`${CACHE_PREFIX}class`))

			// GET /price/class — distinct price_class values (cached 5 min)
			.get(
				"/class",
				async ({ rateLimit, limited, ability, user }) => {
					if (limited) throw new BadRequestError("Rate limit exceeded");
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "read", "ItemCost");

					return withCache(`${CACHE_PREFIX}class`, REF_CACHE_TTL, getDistinctPriceClasses);
				},
			),
	)

	// ── Non-cached endpoints ───────────────────────────────────────
	.use(
		new Elysia()
			.use(authGuard)
			.use(caslMiddleware)
			.use(rateLimitMiddleware())

			// ── Price Class CRUD ─────────────────────────────────────

			// GET /price/classes — all price classes (with pct_discount, dates)
			.get(
				"/classes",
				async ({ rateLimit, limited, ability, user }) => {
					if (limited) throw new BadRequestError("Rate limit exceeded");
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "read", "PriceClass");

					return getCurrentPriceClasses();
				},
			)

			// POST /price/classes — create a price class
			.post(
				"/classes",
				async ({ body, rateLimit, limited, ability, user }) => {
					if (limited) throw new BadRequestError("Rate limit exceeded");
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "create", "PriceClass");

					invalidateCachePrefix(CACHE_PREFIX);
					return createPriceClass(body);
				},
				{
					body: t.Object({
						price_class: t.String({ maxLength: 30 }),
						pct_discount: t.Number(),
						valid_from: t.String({ maxLength: 19 }), // ISO datetime YYYY-MM-DD HH:MM:SS
						valid_to: t.Optional(t.String({ maxLength: 19 })),
					}),
				},
			)

			// PUT /price/classes/:priceClass/:validFrom — update price class
			.put(
				"/classes/:priceClass/:validFrom",
				async ({
					params: { priceClass, validFrom },
					body,
					rateLimit,
					limited,
					ability,
					user,
				}) => {
					if (limited) throw new BadRequestError("Rate limit exceeded");
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "update", "PriceClass");

					invalidateCachePrefix(CACHE_PREFIX);
					return updatePriceClass(priceClass, validFrom, body);
				},
				{
					params: t.Object({
						priceClass: t.String(),
						validFrom: t.String(),
					}),
					body: t.Object({
						pct_discount: t.Optional(t.Number()),
						valid_to: t.Optional(t.Union([t.String({ maxLength: 19 }), t.Null()])),
					}),
				},
			)

			// DELETE /price/classes/:priceClass/:validFrom — delete price class
			.delete(
				"/classes/:priceClass/:validFrom",
				async ({ params: { priceClass, validFrom }, rateLimit, limited, ability, user }) => {
					if (limited) throw new BadRequestError("Rate limit exceeded");
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "delete", "PriceClass");

					invalidateCachePrefix(CACHE_PREFIX);
					await deletePriceClass(priceClass, validFrom);
					return { message: `PriceClass ${priceClass} / ${validFrom} deleted` };
				},
				{
					params: t.Object({
						priceClass: t.String(),
						validFrom: t.String(),
					}),
				},
			)

			// ── Item Cost CRUD ────────────────────────────────────────

			// GET /price/items — get item cost by id
			.get(
				"/items/:id",
				async ({ params: { id }, rateLimit, limited, ability, user }) => {
					if (limited) throw new BadRequestError("Rate limit exceeded");
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "read", "ItemCost");

					const cost = await getItemCostById(id);
					if (!cost) throw new NotFoundError(`ItemCost ${id} not found`);
					return cost;
				},
				{
					params: t.Object({ id: t.Numeric() }),
				},
			)

			// POST /price/items — create item cost
			.post(
				"/items",
				async ({ body, rateLimit, limited, ability, user }) => {
					if (limited) throw new BadRequestError("Rate limit exceeded");
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "create", "ItemCost");

					invalidateCachePrefix(CACHE_PREFIX);
					return createItemCost(body);
				},
				{
					body: t.Object({
						inventory_id: t.String({ maxLength: 30 }),
						cost: t.Number(),
						unit: t.String({ maxLength: 10 }),
						valid_from: t.Optional(t.String({ maxLength: 19 })), // defaults to current DATETIME
						valid_to: t.Optional(t.String({ maxLength: 19 })),
					}),
				},
			)

			// PUT /price/items/:id — replace item cost (expires old, creates new)
			.put(
				"/items/:id",
				async ({
					params: { id },
					body,
					rateLimit,
					limited,
					ability,
					user,
				}) => {
					if (limited) throw new BadRequestError("Rate limit exceeded");
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "update", "ItemCost");

					// Fetch existing record to get inventory_id
					const existing = await getItemCostById(id);
					if (!existing) throw new NotFoundError(`ItemCost ${id} not found`);

					// Expire old cost — set valid_to to 1 second before current time
					const now = new Date();
					const nowStr = now.toISOString().slice(0, 19).replace("T", " ");
					const oneSecBefore = new Date(now.getTime() - 1000);
					const oneSecBeforeStr = oneSecBefore.toISOString().slice(0, 19).replace("T", " ");
					await expireItemCost(id, oneSecBeforeStr);

					// Create new cost entry with updated values
					const newCost = await createItemCost({
						inventory_id: existing.inventory_id,
						cost: body.cost ?? existing.cost,
						unit: body.unit ?? existing.unit,
						valid_from: nowStr,
					});

					invalidateCachePrefix(CACHE_PREFIX);
					return newCost;
				},
				{
					params: t.Object({ id: t.Numeric() }),
					body: t.Object({
						cost: t.Optional(t.Number()),
						unit: t.Optional(t.String({ maxLength: 10 })),
					}),
				},
			)

			// DELETE /price/items/:id — delete item cost
			.delete(
				"/items/:id",
				async ({ params: { id }, rateLimit, limited, ability, user }) => {
					if (limited) throw new BadRequestError("Rate limit exceeded");
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "delete", "ItemCost");

					invalidateCachePrefix(CACHE_PREFIX);
					await deleteItemCost(id);
					return { message: `ItemCost ${id} deleted` };
				},
				{
					params: t.Object({ id: t.Numeric() }),
				},
			)

			// POST /price/items/import — bulk import item costs from Excel data
			.post(
				"/items/import",
				async ({ body, rateLimit, limited, ability, user }) => {
					if (limited) throw new BadRequestError("Rate limit exceeded");
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "create", "ItemCost");

					invalidateCachePrefix(CACHE_PREFIX);
					return importItemCosts(body.items);
				},
				{
					body: t.Object({
						items: t.Array(
							t.Object({
								inventory_id: t.String({ maxLength: 30 }),
								cost: t.Number(),
								unit: t.String({ maxLength: 10 }),
								valid_from: t.Optional(t.String({ maxLength: 19 })),
								valid_to: t.Optional(t.String({ maxLength: 19 })),
							}),
						),
					}),
				},
			)

			// ── Main price listing ───────────────────────────────────

			// GET /price — paginated price records with search, unit, price_class
			.get(
				"/",
				async ({ query, rateLimit, limited, ability, user }) => {
					if (limited) throw new BadRequestError("Rate limit exceeded");
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "read", "ItemCost");

					const page = clamp(Number(query.page) || 1, 1, Infinity);
					const limit = clamp(Number(query.limit) || DEFAULT_LIMIT, 1, MAX_LIMIT);
					const search = query.search;
					const unit = query.unit;

					return getPricesPaginated(page, limit, search, unit);
				},
				{
					query: t.Object({
						page: t.Optional(t.String()),
						limit: t.Optional(t.String()),
						search: t.Optional(t.String()),
						unit: t.Optional(t.String()),
					}),
				},
			),
	);
