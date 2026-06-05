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
	getAllCategories,
	updateCategory,
} from "./min-stock.service";
import { authGuard } from "../../middlewares/auth";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	NotFoundError,
	UnauthorizedError,
} from "../../middlewares/error";

export const minStockRoutes = new Elysia({ prefix: "/min-stock" })
	.use(authGuard)
	.use(caslMiddleware)

	// ── Settings ────────────────────────────────────────────────────

	// GET /min-stock/settings — list all setting overrides
	.get("/settings", async ({ ability, user }) => {
				if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "MinStock");
		return getAllSettings(user.tenant);
	})

	// GET /min-stock/settings/:invtId — get setting for one item
	.get(
		"/settings/:invtId",
		async ({ params: { invtId }, ability, user }) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "MinStock");

			const setting = await getSettingByInvtId(invtId, user.tenant);
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
			ability,
			user,
		}) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "update", "MinStock");

			return upsertSetting({
				inventory_id: invtId,
				class_id: body.class_id,
				min_stock_setting: body.min_stock_setting,
			}, user.tenant);
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
			ability,
			user,
		}) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "update", "MinStock");

			return updateSetting(invtId, {
				min_stock_setting: body.min_stock_setting,
			}, user.tenant);
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
		async ({ params: { invtId }, ability, user }) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "delete", "MinStock");

			await deleteSetting(invtId, user.tenant);
			return { message: `MinStockSetting for ${invtId} deleted` };
		},
		{ params: t.Object({ invtId: t.String() }) },
	)

	// ── MinStock Items ──────────────────────────────────────────────

	// GET /min-stock/items — list all item-level values
	.get("/items", async ({ ability, user }) => {
				if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "MinStock");
		return getAllMinStockItems(user.tenant);
	})

	// GET /min-stock/items/:id — single item-level value by id
	.get(
		"/items/:id",
		async ({ params: { id }, ability, user }) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "MinStock");

			const item = await getMinStockItemById(id, user.tenant);
			if (!item) throw new NotFoundError(`MinStockItem ${id} not found`);
			return item;
		},
		{ params: t.Object({ id: t.Numeric() }) },
	)

	// GET /min-stock/items/invt/:invtId — single item-level value by invtId
	.get(
		"/items/invt/:invtId",
		async ({ params: { invtId }, ability, user }) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "MinStock");

			const item = await getMinStockItemByInvtId(invtId, user.tenant);
			if (!item)
				throw new NotFoundError(`MinStockItem for ${invtId} not found`);
			return item;
		},
		{ params: t.Object({ invtId: t.String() }) },
	)

	// POST /min-stock/items — create item-level min stock
	.post(
		"/items",
		async ({ body, ability, user }) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "create", "MinStock");
			return createMinStockItem(body, user.tenant);
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
			ability,
			user,
		}) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "update", "MinStock");
			return updateMinStockItem(id, body, user.tenant);
		},
		{
			params: t.Object({ id: t.Numeric() }),
			body: t.Object({ min_stock: t.Number() }),
		},
	)

	// DELETE /min-stock/items/:id
	.delete(
		"/items/:id",
		async ({ params: { id }, ability, user }) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "delete", "MinStock");
			await deleteMinStockItem(id, user.tenant);
			return { message: `MinStockItem ${id} deleted` };
		},
		{ params: t.Object({ id: t.Numeric() }) },
	)

	// ── MinStock Principals ─────────────────────────────────────────

	// GET /min-stock/principals — list all principal-level values
	.get("/principals", async ({ ability, user }) => {
				if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "MinStock");
		return getAllMinStockPrincipals(user.tenant);
	})

	// GET /min-stock/principals/:id
	.get(
		"/principals/:id",
		async ({ params: { id }, ability, user }) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "MinStock");

			const p = await getMinStockPrincipalById(id, user.tenant);
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
			ability,
			user,
		}) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "MinStock");

			const p = await getMinStockPrincipalByClassId(classId, user.tenant);
			if (!p)
				throw new NotFoundError(`MinStockPrincipal for class ${classId} not found`);
			return p;
		},
		{ params: t.Object({ classId: t.String() }) },
	)

	// POST /min-stock/principals
	.post(
		"/principals",
		async ({ body, ability, user }) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "create", "MinStock");

			const created = await createMinStockPrincipal(body, user.tenant);
			// Propagate Principal setting to items in this class
			await propagatePrincipalToItems(body.class_id, user.tenant);
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
			ability,
			user,
		}) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "update", "MinStock");

			const updated = await updateMinStockPrincipal(id, body, user.tenant);
			// Propagate Principal setting to items in this class
			await propagatePrincipalToItems(updated.class_id, user.tenant);
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
		async ({ params: { id }, ability, user }) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "delete", "MinStock");
			await deleteMinStockPrincipal(id, user.tenant);
			return { message: `MinStockPrincipal ${id} deleted` };
		},
		{ params: t.Object({ id: t.Numeric() }) },
	)

	// ── Merged (principal/item + min stock) — single-request endpoints ─

	// GET /min-stock/principals-details — all principals with min stock
	.get("/principals-details", async ({ ability, user }) => {
				if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "MinStock");
		return getAllPrincipalsWithMinStock(user.tenant);
	})

	// GET /min-stock/items-details — all items with setting + min stock
	.get("/items-details", async ({ ability, user }) => {
				if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "MinStock");
		return getAllItemsWithMinStock(user.tenant);
	})

	// ── Resolve ─────────────────────────────────────────────────────

	// GET /min-stock/resolve/:invtId/:classId — resolve single item
	.get(
		"/resolve/:invtId/:classId",
		async ({
			params: { invtId, classId },
			ability,
			user,
		}) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "MinStock");
			return resolveMinStock(invtId, classId, user.tenant);
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
		async ({ body, ability, user }) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "MinStock");
			return resolveManyMinStock(body, user.tenant);
		},
		{
			body: t.Array(
				t.Object({
					invtID: t.String(),
					classID: t.String(),
				}),
			),
		},
	)

	// ── Categories ──────────────────────────────────────────────────────

	// GET /min-stock/categories — list all categorisation thresholds
	.get("/categories", async ({ ability, user }) => {
				if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "MinStock");
		return getAllCategories(user.tenant);
	})

	// PATCH /min-stock/categories/:id — update a category threshold
	.patch(
		"/categories/:id",
		async ({
			params: { id },
			body,
			ability,
			user,
		}) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "update", "MinStock");
			return updateCategory(id, body, user.tenant);
		},
		{
			params: t.Object({ id: t.Numeric() }),
			body: t.Object({ threshold: t.Nullable(t.Number()) }),
		},
	);
