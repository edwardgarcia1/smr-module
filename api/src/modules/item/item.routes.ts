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
	createItemSite,
	getAllItemSites,
	getItemSiteById,
	getItemSitesByInvtId,
	updateItemSite,
	deleteItemSite,
	getInventoryWithComponentsAndItemSites,
} from "./item.service";
import { authGuard } from "../../middlewares/auth";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	NotFoundError,
	UnauthorizedError,
} from "../../middlewares/error";

export const itemRoutes = new Elysia({ prefix: "/item" })
	.use(authGuard)
	.use(caslMiddleware)

	// ── Inventory routes ─────────────────────────────────────────────

	// GET /item/inventory — list all inventory
	.get(
		"/inventory",
		async ({ query: { promoFilter }, ability, user }) => {
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
		async ({ params: { invtId }, ability, user }) => {
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
		async ({ body, ability, user }) => {
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
				StkUnit: t.String({ maxLength: 10 }),
			}),
		},
	)

	// PUT /item/inventory/:invtId — update inventory item
	.put(
		"/inventory/:invtId",
		async ({ params: { invtId }, body, ability, user }) => {
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
				StkUnit: t.Optional(t.String({ maxLength: 10 })),
			}),
		},
	)

	// DELETE /item/inventory/:invtId — delete inventory item
	.delete(
		"/inventory/:invtId",
		async ({ params: { invtId }, ability, user }) => {
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
	.get("/component", async ({ ability, user }) => {
				if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");

		return getAllComponents();
	})

	// GET /item/component/:kitId/:cmpnentId — single component
	.get(
		"/component/:kitId/:cmpnentId",
		async ({
			params: { kitId, cmpnentId },
			ability,
			user,
		}) => {
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
		async ({ params: { kitId }, ability, user }) => {
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
		async ({ body, ability, user }) => {
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
			ability,
			user,
		}) => {
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
			ability,
			user,
		}) => {
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

	// ── ItemSite routes ───────────────────────────────────────────────

	// GET /item/site — list all ItemSite records
	.get("/site", async ({ ability, user }) => {
				if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");
		return getAllItemSites();
	})

	// GET /item/site/:invtId/:siteId — single ItemSite record
	.get(
		"/site/:invtId/:siteId",
		async ({
			params: { invtId, siteId },
			ability,
			user,
		}) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			const itemSite = await getItemSiteById(invtId, siteId);
			if (!itemSite)
				throw new NotFoundError(`ItemSite ${invtId}/${siteId} not found`);
			return itemSite;
		},
		{
			params: t.Object({
				invtId: t.String(),
				siteId: t.String(),
			}),
		},
	)

	// GET /item/site/:invtId — ItemSites by InvtID
	.get(
		"/site/:invtId",
		async ({ params: { invtId }, ability, user }) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");
			return getItemSitesByInvtId(invtId);
		},
		{
			params: t.Object({ invtId: t.String() }),
		},
	)

	// POST /item/site — create ItemSite
	.post(
		"/site",
		async ({ body, ability, user }) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "create", "Site");
			return createItemSite(body);
		},
		{
			body: t.Object({
				InvtID: t.String({ maxLength: 30 }),
				SiteID: t.String({ maxLength: 10 }),
				QtyCustOrd: t.Number(),
				QtyAlloc: t.Number(),
				QtyShipNotInv: t.Number(),
				QtyAllocIN: t.Number(),
				QtyOnPO: t.Number(),
				QtyAllocPORet: t.Number(),
				QtyAvail: t.Number(),
				QtyOnHand: t.Number(),
				TotCost: t.Number(),
			}),
		},
	)

	// PUT /item/site/:invtId/:siteId — update ItemSite
	.put(
		"/site/:invtId/:siteId",
		async ({
			params: { invtId, siteId },
			body,
			ability,
			user,
		}) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "update", "Site");
			return updateItemSite(invtId, siteId, body);
		},
		{
			params: t.Object({
				invtId: t.String(),
				siteId: t.String(),
			}),
			body: t.Object({
				QtyCustOrd: t.Optional(t.Number()),
				QtyAlloc: t.Optional(t.Number()),
				QtyShipNotInv: t.Optional(t.Number()),
				QtyAllocIN: t.Optional(t.Number()),
				QtyOnPO: t.Optional(t.Number()),
				QtyAllocPORet: t.Optional(t.Number()),
				QtyAvail: t.Optional(t.Number()),
				QtyOnHand: t.Optional(t.Number()),
				TotCost: t.Optional(t.Number()),
			}),
		},
	)

	// DELETE /item/site/:invtId/:siteId — delete ItemSite
	.delete(
		"/site/:invtId/:siteId",
		async ({
			params: { invtId, siteId },
			ability,
			user,
		}) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "delete", "Site");
			await deleteItemSite(invtId, siteId);
			return { message: `ItemSite ${invtId}/${siteId} deleted` };
		},
		{
			params: t.Object({
				invtId: t.String(),
				siteId: t.String(),
			}),
		},
	)

	// ── Joined route ─────────────────────────────────────────────────

	// GET /item — Inventory + Component + ItemSite on InvtID
	.get(
		"/",
		async ({ query: { sites }, ability, user }) => {
						if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			return getInventoryWithComponentsAndItemSites(sites);
		},
		{
			query: t.Object({
				sites: t.Optional(
					t.String({
						description:
							"Comma-separated SiteID filter, e.g. ?sites=MAIN,CAB,3MPMT,3MPGT",
					}),
				),
			}),
		},
	);
