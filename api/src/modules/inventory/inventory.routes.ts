import { Elysia, t } from "elysia";
import {
	createSite,
	getAllSites,
	getSiteById,
	updateSite,
	deleteSite,
} from "./inventory.service";
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
const CACHE_PREFIX = "inventory:";

export const inventoryRoutes = new Elysia({ prefix: "/inventory" })

	// ── Cached endpoint ────────────────────────────────────────────
	.use(
		new Elysia()
			.use(authGuard)
			.use(caslMiddleware)
			.use(rateLimitMiddleware(`${CACHE_PREFIX}all`))

			// GET /inventory — list all sites (cached 5 min)
			.get("/", async ({ rateLimit, limited, ability, user }) => {
				if (limited) throw new BadRequestError("Rate limit exceeded");
				if (!user) throw new UnauthorizedError("Authentication required");
				checkPermission(ability, "read", "Site");

				return withCache(`${CACHE_PREFIX}all`, REF_CACHE_TTL, getAllSites);
			}),
	)

	// ── Non-cached endpoints ───────────────────────────────────────
	.use(
		new Elysia()
			.use(authGuard)
			.use(caslMiddleware)
			.use(rateLimitMiddleware())

			// GET /inventory/:siteId — get single site
			.get(
				"/:siteId",
				async ({ params: { siteId }, rateLimit, limited, ability, user }) => {
					if (limited) throw new BadRequestError("Rate limit exceeded");
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "read", "Site");

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
				async ({ body, rateLimit, limited, ability, user }) => {
					if (limited) throw new BadRequestError("Rate limit exceeded");
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "create", "Site");

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
				async ({ params: { siteId }, body, rateLimit, limited, ability, user }) => {
					if (limited) throw new BadRequestError("Rate limit exceeded");
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "update", "Site");

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
				async ({ params: { siteId }, rateLimit, limited, ability, user }) => {
					if (limited) throw new BadRequestError("Rate limit exceeded");
					if (!user) throw new UnauthorizedError("Authentication required");
					checkPermission(ability, "delete", "Site");

					invalidateCachePrefix(CACHE_PREFIX);
					await deleteSite(siteId);
					return { message: `Site ${siteId} deleted` };
				},
				{
					params: t.Object({ siteId: t.String() }),
				},
			),
	);
