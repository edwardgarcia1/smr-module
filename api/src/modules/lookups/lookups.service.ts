import { getAllSites } from "../inventory/inventory.service";
import { getAllProductClasses } from "../principal/principal.service";
import { getDistinctCatalogNbr } from "../price/price.service";
import { withCache } from "../../utils/cache";
import type { Site } from "../inventory/inventory.schema";
import type { ProductClass } from "../principal/principal.schema";

/** Cache TTL for combined lookups: 5 minutes */
const LOOKUPS_CACHE_TTL = 5 * 60 * 1000;
const CACHE_KEY = "lookups:all";

export interface LookupsResponse {
	sites: Site[];
	principals: ProductClass[];
	priceClasses: string[];
}

/**
 * Fetch all reference/lookup data in a single call.
 *
 * Aggregates 3 independent queries into one response.
 * All 3 are fetched in parallel and cached together.
 */
export async function getLookups(): Promise<LookupsResponse> {
	return withCache(CACHE_KEY, LOOKUPS_CACHE_TTL, async () => {
		const [sites, principals, priceClasses] = await Promise.all([
			getAllSites(),
			getAllProductClasses(),
			getDistinctCatalogNbr(),
		]);

		return { sites, principals, priceClasses };
	});
}
