import { Elysia, t } from "elysia";
import {
	getAllSettings,
	getSettingByInvtId,
	upsertSetting,
	updateSetting,
	deleteSetting,
	getAllMinStockItems,
	getMinStockItemById,
	getMinStockItemByInvtId,
	createMinStockItem,
	updateMinStockItem,
	deleteMinStockItem,
	getAllMinStockPrincipals,
	getMinStockPrincipalById,
	getMinStockPrincipalByClassId,
	createMinStockPrincipal,
	updateMinStockPrincipal,
	deleteMinStockPrincipal,
	resolveMinStock,
	resolveManyMinStock,
	getAllPrincipalsWithMinStock,
	getAllItemsWithMinStock,
	propagatePrincipalToItems,
} from "./min-stock.service";
import { authGuard } from "../../middlewares/auth";
import { rateLimitMiddleware } from "../../middlewares/rateLimit";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	NotFoundError,
	UnauthorizedError,
} from "../../middlewares/error";

export const minStockRoutes = new Elysia({ prefix: "/min-stock" })
	.use(rateLimitMiddleware())
	.use(authGuard)
	.use(caslMiddleware)

	// ── Settings ────────────────────────────────────────────────────

	// GET /min-stock/settings — list all setting overrides
	.get("/settings", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");
		return getAllSettings();
	})

	// GET /min-stock/settings/:invtId — get setting for one item
	.get(
		"/settings/:invtId",
		async ({ params: { invtId }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			const setting = await getSettingByInvtId(invtId);
			if (!setting)
				throw new NotFoundError(`MinStockSetting for ${invtId} not found`);
			return setting;
		},
		{ params: t.Object({ invtId: t.String() }) },
	)

	// PUT /min-stock/settings/:invtId — upsert a setting
	.put(
		"/settings/:invtId",
		async ({
			params: { invtId },
			body,
			rateLimit,
			limited,
			ability,
			user,
		}) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "update", "Site");

			return upsertSetting({
				inventory_id: invtId,
				class_id: body.class_id,
				min_stock_setting: body.min_stock_setting,
			});
		},
		{
			params: t.Object({ invtId: t.String() }),
			body: t.Object({
				class_id: t.String({ maxLength: 10 }),
				min_stock_setting: t.Union([
					t.Literal("Custom"),
					t.Literal("Principal"),
					t.Literal("Default"),
				]),
			}),
		},
	)

	// PATCH /min-stock/settings/:invtId — update setting only
	.patch(
		"/settings/:invtId",
		async ({
			params: { invtId },
			body,
			rateLimit,
			limited,
			ability,
			user,
		}) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "update", "Site");

			return updateSetting(invtId, {
				min_stock_setting: body.min_stock_setting,
			});
		},
		{
			params: t.Object({ invtId: t.String() }),
			body: t.Object({
				min_stock_setting: t.Union([
					t.Literal("Custom"),
					t.Literal("Principal"),
					t.Literal("Default"),
				]),
			}),
		},
	)

	// DELETE /min-stock/settings/:invtId — remove setting (falls back to Default)
	.delete(
		"/settings/:invtId",
		async ({ params: { invtId }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "delete", "Site");

			await deleteSetting(invtId);
			return { message: `MinStockSetting for ${invtId} deleted` };
		},
		{ params: t.Object({ invtId: t.String() }) },
	)

	// ── MinStock Items ──────────────────────────────────────────────

	// GET /min-stock/items — list all item-level values
	.get("/items", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");
		return getAllMinStockItems();
	})

	// GET /min-stock/items/:id — single item-level value by id
	.get(
		"/items/:id",
		async ({ params: { id }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			const item = await getMinStockItemById(id);
			if (!item) throw new NotFoundError(`MinStockItem ${id} not found`);
			return item;
		},
		{ params: t.Object({ id: t.Numeric() }) },
	)

	// GET /min-stock/items/invt/:invtId — single item-level value by invtId
	.get(
		"/items/invt/:invtId",
		async ({ params: { invtId }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			const item = await getMinStockItemByInvtId(invtId);
			if (!item)
				throw new NotFoundError(`MinStockItem for ${invtId} not found`);
			return item;
		},
		{ params: t.Object({ invtId: t.String() }) },
	)

	// POST /min-stock/items — create item-level min stock
	.post(
		"/items",
		async ({ body, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "create", "Site");
			return createMinStockItem(body);
		},
		{
			body: t.Object({
				inventory_id: t.String({ maxLength: 30 }),
				min_stock: t.Number(),
			}),
		},
	)

	// PUT /min-stock/items/:id — update item-level min stock
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
			checkPermission(ability, "update", "Site");
			return updateMinStockItem(id, body);
		},
		{
			params: t.Object({ id: t.Numeric() }),
			body: t.Object({ min_stock: t.Number() }),
		},
	)

	// DELETE /min-stock/items/:id
	.delete(
		"/items/:id",
		async ({ params: { id }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "delete", "Site");
			await deleteMinStockItem(id);
			return { message: `MinStockItem ${id} deleted` };
		},
		{ params: t.Object({ id: t.Numeric() }) },
	)

	// ── MinStock Principals ─────────────────────────────────────────

	// GET /min-stock/principals — list all principal-level values
	.get("/principals", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");
		return getAllMinStockPrincipals();
	})

	// GET /min-stock/principals/:id
	.get(
		"/principals/:id",
		async ({ params: { id }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			const p = await getMinStockPrincipalById(id);
			if (!p) throw new NotFoundError(`MinStockPrincipal ${id} not found`);
			return p;
		},
		{ params: t.Object({ id: t.Numeric() }) },
	)

	// GET /min-stock/principals/class/:classId
	.get(
		"/principals/class/:classId",
		async ({
			params: { classId },
			rateLimit,
			limited,
			ability,
			user,
		}) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			const p = await getMinStockPrincipalByClassId(classId);
			if (!p)
				throw new NotFoundError(`MinStockPrincipal for class ${classId} not found`);
			return p;
		},
		{ params: t.Object({ classId: t.String() }) },
	)

	// POST /min-stock/principals
	.post(
		"/principals",
		async ({ body, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "create", "Site");

			const created = await createMinStockPrincipal(body);
			// Propagate Principal setting to items in this class
			await propagatePrincipalToItems(body.class_id);
			return created;
		},
		{
			body: t.Object({
				class_id: t.String({ maxLength: 10 }),
				min_stock: t.Number(),
			}),
		},
	)

	// PUT /min-stock/principals/:id
	.put(
		"/principals/:id",
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
			checkPermission(ability, "update", "Site");

			const updated = await updateMinStockPrincipal(id, body);
			// Propagate Principal setting to items in this class
			await propagatePrincipalToItems(updated.class_id);
			return updated;
		},
		{
			params: t.Object({ id: t.Numeric() }),
			body: t.Object({ min_stock: t.Number() }),
		},
	)

	// DELETE /min-stock/principals/:id
	.delete(
		"/principals/:id",
		async ({ params: { id }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "delete", "Site");
			await deleteMinStockPrincipal(id);
			return { message: `MinStockPrincipal ${id} deleted` };
		},
		{ params: t.Object({ id: t.Numeric() }) },
	)

	// ── Merged (principal/item + min stock) — single-request endpoints ─

	// GET /min-stock/principals-details — all principals with min stock
	.get("/principals-details", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");
		return getAllPrincipalsWithMinStock();
	})

	// GET /min-stock/items-details — all items with setting + min stock
	.get("/items-details", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");
		return getAllItemsWithMinStock();
	})

	// ── Resolve ─────────────────────────────────────────────────────

	// GET /min-stock/resolve/:invtId/:classId — resolve single item
	.get(
		"/resolve/:invtId/:classId",
		async ({
			params: { invtId, classId },
			rateLimit,
			limited,
			ability,
			user,
		}) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");
			return resolveMinStock(invtId, classId);
		},
		{
			params: t.Object({
				invtId: t.String(),
				classId: t.String(),
			}),
		},
	)

	// POST /min-stock/resolve — bulk resolve
	.post(
		"/resolve",
		async ({ body, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");
			return resolveManyMinStock(body);
		},
		{
			body: t.Array(
				t.Object({
					invtID: t.String(),
					classID: t.String(),
				}),
			),
		},
	);
