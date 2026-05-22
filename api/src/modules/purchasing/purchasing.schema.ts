// Types for Purchase Requirements module
// Combines sales, inventory, and unit conversion data

export interface RequirementsQuery {
	classID: string;
	siteID?: string[];
	dateRanges: DateRange[];
	frequency: "weekly" | "monthly";
}

export interface DateRange {
	start: string; // YYYY-MM-DD
	end: string; // YYYY-MM-DD
}

/** A single requirement item row returned by the API */
export interface RequirementItem {
	invtID: string;
	descr: string;
	stkUnit: string;
	classID: string;
	// Quantities from ItemSite (already in StkUnit)
	qtyOnHand: number;
	qtyAvail: number;
	qtyOnPO: number; // Incoming
	qtyAlloc: number; // Unreleased (customer orders allocated)
	// Normalized sales qtyShip per period key (e.g. "Jan 2026" or "W1 Jan 2026")
	periodDemand: Record<string, number>;
	// Calculated fields
	avgDemand: number; // Average monthly or weekly demand
	stockCoverCount: number; // How many periods stock will last (qtyAvail / avgDemand)
	monthlyFactor: number; // Default 1.0, editable
	/** avgDemand * monthlyFactor — projected monthly need */
	suggestedMonthlyOrder: number;
	/**
	 * Stock-aware coverage threshold (resolved from min-stock settings).
	 * Source: Custom → per-item SMR_MinStockItem value
	 *         Principal → per-class SMR_MinStockPrincipal value
	 *         Default   → global default (1.0)
	 */
	coverageThreshold: number;
	/**
	 * Stock-aware order quantity.
	 * Formula: max(0, (coverageThreshold * avgDemand * monthlyFactor) - qtyAvail)
	 */
	suggestedOrder: number;
	customOrder: number | null;
}
