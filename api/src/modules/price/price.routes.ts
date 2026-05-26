import { Elysia, t } from "elysia";
import {
	createItemPrice,
	getItemPriceById,
	expireItemPrice,
	deleteItemPrice,
	importItemPrices,
	createPriceClass,
	getAllPriceClasses,
	getCurrentPriceClasses,
	getPriceClassById,
	getDistinctPriceClasses,
	updatePriceClass,
	deletePriceClass,
	getPricesPaginated,
	batchConvertPrices,
	MAX_LIMIT,
	DEFAULT_LIMIT,
} from "./price.service";
import { authGuard } from "../../middlewares/auth";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	NotFoundError,
	UnauthorizedError,
} from "../../middlewares/error";
import { withCache, invalidateCachePrefix } from "../../utils/cache";
import { toPlainJson } from "./price.schema";

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
			// GET /price/class — distinct price_class values (cached 5 min)
			.get(
				"/class",
				async ({ ability, user }) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "read", "PriceClass");

					return withCache(`${CACHE_PREFIX}class`, REF_CACHE_TTL, getDistinctPriceClasses);
				},
			),
	)

	// ── Non-cached endpoints ───────────────────────────────────────
	.use(
		new Elysia()
			.use(authGuard)
			.use(caslMiddleware)
			// ── Price Class CRUD (simplified lookup) ─────────────────────

			// GET /price/classes — all price classes
			.get(
				"/classes",
				async ({ ability, user }) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "read", "PriceClass");

					return toPlainJson(await getAllPriceClasses());
				},
			)

			// POST /price/classes — create a price class
			.post(
				"/classes",
				async ({ body, ability, user }) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "create", "PriceClass");

					invalidateCachePrefix(CACHE_PREFIX);
					return toPlainJson(await createPriceClass(body));
				},
				{
					body: t.Object({
						id: t.String({ maxLength: 30 }),
						description: t.Optional(t.String({ maxLength: 150 })),
					}),
				},
			)

			// PUT /price/classes/:id — update price class description
			.put(
				"/classes/:id",
				async ({
					params: { id },
					body,
					ability,
					user,
				}) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "update", "PriceClass");

					invalidateCachePrefix(CACHE_PREFIX);
					return toPlainJson(await updatePriceClass(id, body));
				},
				{
					params: t.Object({
						id: t.String({ maxLength: 30 }),
					}),
					body: t.Object({
						description: t.Optional(t.Union([t.String({ maxLength: 150 }), t.Null()])),
					}),
				},
			)

			// DELETE /price/classes/:id — delete price class by id
			.delete(
				"/classes/:id",
				async ({ params: { id }, ability, user }) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "delete", "PriceClass");

					invalidateCachePrefix(CACHE_PREFIX);
					await deletePriceClass(id);
					return { message: `PriceClass '${id}' deleted` };
				},
				{
					params: t.Object({
						id: t.String({ maxLength: 30 }),
					}),
				},
			)

			// ── Item Price CRUD (renamed from ItemCost) ───────────────────

			// GET /price/items/:id — get item price by id
			.get(
				"/items/:id",
				async ({ params: { id }, ability, user }) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "read", "ItemPrice");

					const price = await getItemPriceById(id);
					if (!price) throw new NotFoundError(`ItemPrice ${id} not found`);
					return toPlainJson(price);
				},
				{
					params: t.Object({ id: t.Numeric() }),
				},
			)

			// POST /price/items — create item price
			.post(
				"/items",
				async ({ body, ability, user }) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "create", "ItemPrice");

					invalidateCachePrefix(CACHE_PREFIX);
					return toPlainJson(await createItemPrice(body));
				},
				{
					body: t.Object({
						inventory_id: t.String({ maxLength: 30 }),
						price: t.Number(),
						unit: t.String({ maxLength: 10 }),
						price_class: t.String({ maxLength: 30 }),
						valid_from: t.Optional(t.String({ maxLength: 19 })), // defaults to current DATETIME
						valid_to: t.Optional(t.Union([t.String({ maxLength: 19 }), t.Null()])),
					}),
				},
			)

			// PUT /price/items/:id — replace item price (expires old, creates new)
			.put(
				"/items/:id",
				async ({
					params: { id },
					body,
					ability,
					user,
				}) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "update", "ItemPrice");

					// Fetch existing record to get inventory_id
					const existing = await getItemPriceById(id);
					if (!existing) throw new NotFoundError(`ItemPrice ${id} not found`);

					// Expire old price — set valid_to to 1 second before current time
					const now = new Date();
					const nowStr = now.toISOString().slice(0, 19).replace("T", " ");
					const oneSecBefore = new Date(now.getTime() - 1000);
					const oneSecBeforeStr = oneSecBefore.toISOString().slice(0, 19).replace("T", " ");
					await expireItemPrice(id, oneSecBeforeStr);

					// Create new price entry with updated values
					const newPrice = await createItemPrice({
						inventory_id: existing.inventory_id,
						price: body.price ?? existing.price,
						unit: body.unit ?? existing.unit,
						price_class: body.price_class ?? existing.price_class,
						valid_from: nowStr,
					});

					invalidateCachePrefix(CACHE_PREFIX);
					return toPlainJson(newPrice);
				},
				{
					params: t.Object({ id: t.Numeric() }),
					body: t.Object({
						price: t.Optional(t.Number()),
						unit: t.Optional(t.String({ maxLength: 10 })),
						price_class: t.Optional(t.String({ maxLength: 30 })),
					}),
				},
			)

			// DELETE /price/items/:id — delete item price
			.delete(
				"/items/:id",
				async ({ params: { id }, ability, user }) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "delete", "ItemPrice");

					invalidateCachePrefix(CACHE_PREFIX);
					await deleteItemPrice(id);
					return { message: `ItemPrice ${id} deleted` };
				},
				{
					params: t.Object({ id: t.Numeric() }),
				},
			)

			// POST /price/items/import — bulk import item prices from Excel data
			.post(
				"/items/import",
				async ({ body, ability, user }) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "create", "ItemPrice");

					invalidateCachePrefix(CACHE_PREFIX);
					return importItemPrices(body.items);
				},
				{
					body: t.Object({
						items: t.Array(
							t.Object({
								inventory_id: t.String({ maxLength: 30 }),
								price: t.Number(),
								unit: t.String({ maxLength: 10 }),
								price_class: t.String({ maxLength: 30 }),
								valid_from: t.Optional(t.String({ maxLength: 19 })),
								valid_to: t.Optional(t.Union([t.String({ maxLength: 19 }), t.Null()])),
							}),
						),
					}),
				},
			)

			// ── Batch price conversion ────────────────────────────────

			// POST /price/convert — batch convert prices to different units
			.post(
				"/convert",
				async ({ body, ability, user }) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "read", "ItemPrice");

					return batchConvertPrices(body.items);
				},
				{
					body: t.Object({
						items: t.Array(
							t.Object({
								inventory_id: t.String({ maxLength: 30 }),
								price: t.Number(),
								from_unit: t.String({ maxLength: 10 }),
								to_unit: t.String({ maxLength: 10 }),
								price_class: t.String({ maxLength: 30 }),
							}),
						),
					}),
				},
			)

			// ── Main price listing ───────────────────────────────────

			// GET /price — paginated price records with search, unit
			.get(
				"/",
				async ({ query, ability, user }) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "read", "ItemPrice");

					const page = clamp(Number(query.page) || 1, 1, Infinity);
					const limit = clamp(Number(query.limit) || DEFAULT_LIMIT, 1, MAX_LIMIT);
					const search = query.search;
					const unit = query.unit;
					const classID = query.classID;

					return toPlainJson(
						await getPricesPaginated(page, limit, search, unit, classID),
					);
				},
				{
					query: t.Object({
						page: t.Optional(t.String()),
						limit: t.Optional(t.String()),
						search: t.Optional(t.String()),
						unit: t.Optional(t.String()),
						classID: t.Optional(t.String()),
					}),
				},
			),
	);
