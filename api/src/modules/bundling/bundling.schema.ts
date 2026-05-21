// ─── Bundling Module Types ─────────────────────────────────────────────
// Similar to purchasing but for promo/kit items only.
// A promo item (kit) consists of multiple component items.
// The bundling check determines whether demand can be fulfilled
// by bundling existing component stock rather than purchasing the promo item itself.

export interface BundlingQuery {
	classID: string;
	siteID?: string[];
	dateRanges: DateRange[];
	frequency: "weekly" | "monthly";
}

export interface DateRange {
	start: string; // YYYY-MM-DD
	end: string;   // YYYY-MM-DD
}

/** Stock data for a single component of a promo kit */
export interface ComponentStock {
	cmpnentID: string;
	descr: string;
	stkUnit: string;
	qtyPerBundle: number;   // How many units of this component per 1 promo kit
	qtyOnHand: number;
	qtyAvail: number;
	qtyOnPO: number;
	qtyAlloc: number;
	maxBundlesFromStock: number; // floor(qtyAvail / qtyPerBundle)
}

/** A single promo/kit item returned by the bundling endpoint */
export interface BundlingItem {
	invtID: string;
	descr: string;
	stkUnit: string;
	classID: string;
	// Stock levels for the promo item itself
	qtyOnHand: number;
	qtyAvail: number;
	qtyOnPO: number;
	qtyAlloc: number;
	// Demand data (same as purchasing)
	periodDemand: Record<string, number>;
	avgDemand: number;
	stockCoverCount: number;
	// Component information
	components: ComponentStock[];
	/** How many complete bundles can be made from existing component stock */
	bundlableQuantity: number;
	/** Suggested number of bundles to produce (limited by demand and component stock) */
	suggestedBundles: number;
	/** True if bundlableQuantity >= avg demand — demand can be met via bundling */
	canFulfillFromBundling: boolean;
}
