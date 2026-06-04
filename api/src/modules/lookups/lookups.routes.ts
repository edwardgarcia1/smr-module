import { Elysia } from "elysia";
import { getLookups } from "./lookups.service";
import { authGuard } from "../../middlewares/auth";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	UnauthorizedError,
} from "../../middlewares/error";

export const lookupsRoutes = new Elysia({ prefix: "/lookups" })
	.use(authGuard)
	.use(caslMiddleware)

	/**
	 * GET /lookups — All reference data in one request.
	 *
	 * Returns sites, principals, price classes, and min-stock categories
	 * in a single paginated-free call. Data is cached for 5 minutes.
	 *
	 * Frontends use this to populate dropdowns/autocompletes
	 * instead of making 4 separate requests.
	 *
	 * Response:
	 *   { sites: Site[], principals: ProductClassWithVendor[], priceClasses: string[], minStockCategories: MinStockCategory[] }
	 */
	.get("/", async ({ ability, user }) => {
			if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Settings");

		return getLookups();
	});
