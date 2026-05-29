// ─── Dashboard Summary Types ────────────────────────────────────────────
// Lightweight aggregated snapshot — no sales history joins.
// All queries are simple COUNT/SUM aggregations running in parallel.

export interface ItemsPerPrincipal {
	classID: string;
	description: string;
	itemCount: number;
}

export interface MinStockSettingDistribution {
	custom: number;
	principal: number;
	default: number;
}

export interface DashboardSummary {
	/** Total items in the Inventory table */
	totalInventoryItems: number;
	/** Total product classes (principals) */
	totalPrincipals: number;
	/** Items with no current (valid_to IS NULL) price record */
	itemsWithoutPrice: number;
	/** ItemSite rows where QtyAvail <= 0 */
	itemsZeroAvailable: number;
	/** SUM of QtyOnPO across all ItemSite rows */
	totalQtyOnPO: number;
	/** SUM of TotCost across all ItemSite rows */
	totalStockValue: number;
	/** Total registered SMR_Users */
	totalUsers: number;
	/** Items grouped by principal, sorted descending by count */
	itemsPerPrincipal: ItemsPerPrincipal[];
	/** SMR_MinStockSetting distribution across the three options */
	minStockSettingDistribution: MinStockSettingDistribution;
}
