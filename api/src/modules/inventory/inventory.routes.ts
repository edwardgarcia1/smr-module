import { Elysia, t } from "elysia";
import {
	createSite,
	getAllSites,
	getSiteById,
	updateSite,
	deleteSite,
} from "./inventory.service";
import { authGuard } from "../../middlewares/auth";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	NotFoundError,
	UnauthorizedError,
} from "../../middlewares/error";
import { withCache, invalidateCachePrefix } from "../../utils/cache";

/** Cache TTL for reference data: 5 minutes */
const REF_CACHE_TTL = 5 * 60 * 1000;
const CACHE_PREFIX = "inventory:";

export const inventoryRoutes = new Elysia({ prefix: "/inventory" })

	// ── Cached endpoint ────────────────────────────────────────────
	.use(
		new Elysia()
			.use(authGuard)
			.use(caslMiddleware)
			// GET /inventory — list all sites (cached 5 min)
			.get("/", async ({ ability, user }) => {
				if (!user) throw new UnauthorizedError("Authentication required");
				checkPermission(ability, "read", "InventoryItems");

				return withCache(`${CACHE_PREFIX}all`, REF_CACHE_TTL, getAllSites);
			}),
	)

	// ── Non-cached endpoints ───────────────────────────────────────
	.use(
		new Elysia()
			.use(authGuard)
			.use(caslMiddleware)
			// GET /inventory/:siteId — get single site
			.get(
				"/:siteId",
				async ({ params: { siteId }, ability, user }) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "read", "InventoryItems");

					const site = await getSiteById(siteId);
					if (!site) throw new NotFoundError(`Site ${siteId} not found`);
					return site;
				},
				{
					params: t.Object({ siteId: t.String() }),
				},
			)

			// POST /inventory — create site
			.post(
				"/",
				async ({ body, ability, user }) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "create", "InventoryItems");

					invalidateCachePrefix(CACHE_PREFIX);
					return createSite(body);
				},
				{
					body: t.Object({
						SiteId: t.String({ maxLength: 10 }),
						Name: t.String({ maxLength: 30 }),
					}),
				},
			)

			// PUT /inventory/:siteId — update site name
			.put(
				"/:siteId",
				async ({ params: { siteId }, body, ability, user }) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "update", "InventoryItems");

					invalidateCachePrefix(CACHE_PREFIX);
					return updateSite(siteId, body);
				},
				{
					params: t.Object({ siteId: t.String() }),
					body: t.Object({
						Name: t.String({ maxLength: 30 }),
					}),
				},
			)

			// DELETE /inventory/:siteId — delete site
			.delete(
				"/:siteId",
				async ({ params: { siteId }, ability, user }) => {
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "delete", "InventoryItems");

					invalidateCachePrefix(CACHE_PREFIX);
					await deleteSite(siteId);
					return { message: `Site ${siteId} deleted` };
				},
				{
					params: t.Object({ siteId: t.String() }),
				},
			),
	);
