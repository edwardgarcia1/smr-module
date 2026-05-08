import { Elysia, t } from "elysia";
import {
	createInventory,
	getAllInventory,
	getInventoryById,
	updateInventory,
	deleteInventory,
	createComponent,
	getAllComponents,
	getComponentById,
	getComponentsByKitId,
	updateComponent,
	deleteComponent,
	getInventoryWithComponents,
} from "./item.service";
import { authGuard } from "../../middlewares/auth";
import { rateLimitMiddleware } from "../../middlewares/rateLimit";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	NotFoundError,
	UnauthorizedError,
} from "../../middlewares/error";

export const itemRoutes = new Elysia({ prefix: "/item" })
	.use(rateLimitMiddleware)
	.use(authGuard)
	.use(caslMiddleware)

	// ── Inventory routes ─────────────────────────────────────────────

	// GET /item/inventory — list all inventory
	.get(
		"/inventory",
		async ({ query: { promoFilter }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			return getAllInventory(
				(promoFilter ?? "all") as "all" | "promos" | "non_promos",
			);
		},
		{
			query: t.Object({
				promoFilter: t.Optional(
					t.String({
						pattern: "^(all|promos|non_promos)$",
					}),
				),
			}),
		},
	)

	// GET /item/inventory/:invtId — single inventory item
	.get(
		"/inventory/:invtId",
		async ({ params: { invtId }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			const inv = await getInventoryById(invtId);
			if (!inv) throw new NotFoundError(`Inventory ${invtId} not found`);
			return inv;
		},
		{
			params: t.Object({ invtId: t.String() }),
		},
	)

	// POST /item/inventory — create inventory item
	.post(
		"/inventory",
		async ({ body, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "create", "Site");

			return createInventory(body);
		},
		{
			body: t.Object({
				InvtID: t.String({ maxLength: 30 }),
				ClassID: t.String({ maxLength: 10 }),
				ProdMgrID: t.String({ maxLength: 10 }),
				Descr: t.String({ maxLength: 100 }),
			}),
		},
	)

	// PUT /item/inventory/:invtId — update inventory item
	.put(
		"/inventory/:invtId",
		async ({ params: { invtId }, body, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "update", "Site");

			return updateInventory(invtId, body);
		},
		{
			params: t.Object({ invtId: t.String() }),
			body: t.Object({
				ClassID: t.Optional(t.String({ maxLength: 10 })),
				ProdMgrID: t.Optional(t.String({ maxLength: 10 })),
				Descr: t.Optional(t.String({ maxLength: 100 })),
			}),
		},
	)

	// DELETE /item/inventory/:invtId — delete inventory item
	.delete(
		"/inventory/:invtId",
		async ({ params: { invtId }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "delete", "Site");

			await deleteInventory(invtId);
			return { message: `Inventory ${invtId} deleted` };
		},
		{
			params: t.Object({ invtId: t.String() }),
		},
	)

	// ── Component routes ─────────────────────────────────────────────

	// GET /item/component — list all components
	.get("/component", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");

		return getAllComponents();
	})

	// GET /item/component/:kitId/:cmpnentId — single component
	.get(
		"/component/:kitId/:cmpnentId",
		async ({
			params: { kitId, cmpnentId },
			rateLimit,
			limited,
			ability,
			user,
		}) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			const comp = await getComponentById(kitId, cmpnentId);
			if (!comp)
				throw new NotFoundError(`Component ${kitId}/${cmpnentId} not found`);
			return comp;
		},
		{
			params: t.Object({
				kitId: t.String(),
				cmpnentId: t.String(),
			}),
		},
	)

	// GET /item/component/:kitId — get components by kit
	.get(
		"/component/:kitId",
		async ({ params: { kitId }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			return getComponentsByKitId(kitId);
		},
		{
			params: t.Object({ kitId: t.String() }),
		},
	)

	// POST /item/component — create component
	.post(
		"/component",
		async ({ body, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "create", "Site");

			return createComponent(body);
		},
		{
			body: t.Object({
				KitID: t.String({ maxLength: 30 }),
				CmpnentID: t.String({ maxLength: 30 }),
				CmpnentQty: t.Number(),
			}),
		},
	)

	// PUT /item/component/:kitId/:cmpnentId — update component
	.put(
		"/component/:kitId/:cmpnentId",
		async ({
			params: { kitId, cmpnentId },
			body,
			rateLimit,
			limited,
			ability,
			user,
		}) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "update", "Site");

			return updateComponent(kitId, cmpnentId, body);
		},
		{
			params: t.Object({
				kitId: t.String(),
				cmpnentId: t.String(),
			}),
			body: t.Object({
				CmpnentQty: t.Optional(t.Number()),
			}),
		},
	)

	// DELETE /item/component/:kitId/:cmpnentId — delete component
	.delete(
		"/component/:kitId/:cmpnentId",
		async ({
			params: { kitId, cmpnentId },
			rateLimit,
			limited,
			ability,
			user,
		}) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "delete", "Site");

			await deleteComponent(kitId, cmpnentId);
			return {
				message: `Component ${kitId}/${cmpnentId} deleted`,
			};
		},
		{
			params: t.Object({
				kitId: t.String(),
				cmpnentId: t.String(),
			}),
		},
	)

	// ── Joined route ─────────────────────────────────────────────────

	// GET /item — Inventory + Component on InvtID = KitID
	.get("/", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");

		return getInventoryWithComponents();
	});
