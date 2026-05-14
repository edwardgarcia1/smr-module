import { Elysia } from "elysia";
import { getLookups } from "./lookups.service";
import { authGuard } from "../../middlewares/auth";
import { rateLimitMiddleware } from "../../middlewares/rateLimit";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	UnauthorizedError,
} from "../../middlewares/error";

/**
 * Cache key used by the rate limiter to skip rate limiting when
 * the lookups data is already in cache (hot).
 */
const CACHE_KEY = "lookups:all";

export const lookupsRoutes = new Elysia({ prefix: "/lookups" })
	.use(rateLimitMiddleware(CACHE_KEY))
	.use(authGuard)
	.use(caslMiddleware)

	/**
	 * GET /lookups — All reference data in one request.
	 *
	 * Returns sites, principals, and price classes in a single
	 * paginated-free call. Data is cached for 5 minutes.
	 *
	 * Frontends use this to populate dropdowns/autocompletes
	 * instead of making 3 separate requests.
	 *
	 * Response:
	 *   { sites: Site[], principals: ProductClass[], priceClasses: string[] }
	 */
	.get("/", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");

		return getLookups();
	});
