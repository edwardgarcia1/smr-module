import { getAllSites } from "../inventory/inventory.service";
import { getProductClassesWithVendors } from "../principal/principal.service";
import { getDistinctCatalogNbr } from "../price/price.service";
import { getAllCategories } from "../min-stock/min-stock.service";
import { withCache } from "../../utils/cache";
import type { Site } from "../inventory/inventory.schema";
import type { ProductClassWithVendor } from "../principal/principal.schema";
import type { MinStockCategory } from "../min-stock/min-stock.schema";

/** Cache TTL for combined lookups: 5 minutes */
const LOOKUPS_CACHE_TTL = 5 * 60 * 1000;

export interface LookupsResponse {
	sites: Site[];
	principals: ProductClassWithVendor[];
	priceClasses: string[];
	minStockCategories: MinStockCategory[];
}

/**
 * Fetch all reference/lookup data in a single call.
 *
 * Aggregates 4 independent queries into one response.
 * All 4 are fetched in parallel and cached together.
 */
export async function getLookups(tenantKey = "default"): Promise<LookupsResponse> {
	return withCache(`lookups:all:${tenantKey}`, LOOKUPS_CACHE_TTL, async () => {
		const [sites, principals, priceClasses, minStockCategories] =
			await Promise.all([
				getAllSites(tenantKey),
				getProductClassesWithVendors(tenantKey),
				getDistinctCatalogNbr(tenantKey),
				getAllCategories(tenantKey),
			]);

		return { sites, principals, priceClasses, minStockCategories };
	});
}
