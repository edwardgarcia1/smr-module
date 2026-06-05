/**
 * Requirements feature: types, constants, and pure utility functions.
 * Extracted from the monolithic RequirementsPage.tsx to improve DRY, SoC, and modularity.
 */

import type { Dayjs } from "dayjs";

// ─── Mode / Frequency ─────────────────────────────────────────────────────────

export type Mode = "purchasing" | "bundling";
export type Frequency = "weekly" | "monthly";
export type DemandMode = "average" | "highest";
export type DemandSource = "shipped" | "ordered";

export const DEMAND_MODES: DemandMode[] = ["average", "highest"];
export const FREQUENCIES: Frequency[] = ["weekly", "monthly"];

// ─── Data Types ───────────────────────────────────────────────────────────────

export interface MinStockCategory {
	id: number;
	category_name: string;
	threshold: number | null;
}

export interface Principal {
	ClassID: string;
	Descr: string;
	User5: string;
	/** Vendor identifier (from Vendor table join) */
	VendId?: string;
	/** Vendor address line 1 */
	VendorAddr1?: string;
	/** Vendor address line 2 */
	VendorAddr2?: string;
	/** Vendor city */
	VendorCity?: string;
	/** Vendor payment terms */
	VendorTerms?: string;
}

export interface StorageLocation {
	id: string;
	name: string;
}

// ─── Purchasing Row Types ─────────────────────────────────────────────────────

export interface RequirementRow {
	invtID: string;
	descr: string;
	stkUnit: string;
	qtyPerCS: number;
	classID: string;
	qtyOnHand: number;
	qtyAvail: number;
	qtyOnPO: number;
	qtyAlloc: number;
	periodDemand: Record<string, number>;
	avgDemand: number;
	avgDemandCS: number;
	totalDemandCS: number;
	stockCoverCount: number;
	coverageThreshold: number;
	suggestedOrder: number;
	suggestedOrderCS: number;
	customOrder: number | null;
	amount: number | null;
	price_ao?: string;
	price_perCS?: number;
	price_perStkUnit?: number;
}

// ─── Bundling Row Types ───────────────────────────────────────────────────────

export interface ComponentStock {
	cmpnentID: string;
	descr: string;
	stkUnit: string;
	qtyPerBundle: number;
	qtyOnHand: number;
	qtyAvail: number;
	qtyOnPO: number;
	qtyAlloc: number;
	maxBundlesFromStock: number;
}

export interface BundlingRow {
	invtID: string;
	descr: string;
	stkUnit: string;
	classID: string;
	qtyOnHand: number;
	qtyAvail: number;
	qtyOnPO: number;
	qtyAlloc: number;
	periodDemand: Record<string, number>;
	avgDemand: number;
	stockCoverCount: number;
	coverageThreshold: number | null;
	suggestedOrder: number | null;
	components: ComponentStock[];
	bundlableQuantity: number;
	suggestedBundles: number;
	canFulfillFromBundling: boolean;
}

// ─── Category Constants ───────────────────────────────────────────────────────

export const CATEGORY_NAMES = [
	"Immediate",
	"Secondary",
	"Monitoring",
	"Ordered",
	"Overstocked",
	"No record",
] as const;

export const CATEGORY_CLASS_MAP: Record<string, string> = {
	Immediate: "row-immediate",
	Secondary: "row-secondary",
	Monitoring: "row-monitoring",
	Ordered: "row-ordered",
	Overstocked: "row-overstocked",
	"No record": "row-no-record",
};

export const CAT_EXCEL_COLORS: Record<string, string> = {
	Immediate: "ffcdd2",
	Secondary: "fff9c4",
	Monitoring: "bbdefb",
	Ordered: "e1bee7",
	Overstocked: "c8e6c9",
	"No record": "eceff1",
};

export const CATEGORY_ORDER: Record<string, number> = {
	Immediate: 0,
	Secondary: 1,
	Monitoring: 2,
	Ordered: 3,
	Overstocked: 4,
	"No record": 5,
};

export const ALLOWED_SITE_IDS = new Set(["MAIN", "CAB", "3MPMT", "3MPGT"]);

// ─── Category Colors (dark-mode aware) ────────────────────────────────────────

export interface CategoryColorScheme {
	bg: string;
	chipBg: string;
	chipText: string;
}

/** Build a dark-mode-aware category color lookup. Pure function, no hook needed. */
export function getCategoryColors(darkMode: boolean): Record<string, CategoryColorScheme> {
	return {
		Immediate: {
			bg: darkMode ? "rgba(211, 47, 47, 0.35)" : "#ffcdd2",
			chipBg: darkMode ? "#b71c1c" : "#d32f2f",
			chipText: "#ffffff",
		},
		Secondary: {
			bg: darkMode ? "rgba(255, 193, 7, 0.30)" : "#fff9c4",
			chipBg: darkMode ? "#f57f17" : "#f9a825",
			chipText: "#ffffff",
		},
		Monitoring: {
			bg: darkMode ? "rgba(33, 150, 243, 0.27)" : "#bbdefb",
			chipBg: darkMode ? "#0d47a1" : "#1976d2",
			chipText: "#ffffff",
		},
		Ordered: {
			bg: darkMode ? "rgba(156, 39, 176, 0.25)" : "#e1bee7",
			chipBg: darkMode ? "#4a148c" : "#7b1fa2",
			chipText: "#ffffff",
		},
		Overstocked: {
			bg: darkMode ? "rgba(76, 175, 80, 0.27)" : "#c8e6c9",
			chipBg: darkMode ? "#1b5e20" : "#388e3c",
			chipText: "#ffffff",
		},
		"No record": {
			bg: darkMode ? "rgba(158, 158, 158, 0.25)" : "#eceff1",
			chipBg: darkMode ? "#37474f" : "#616161",
			chipText: "#ffffff",
		},
	};
}

// ─── Pure Utility Functions ───────────────────────────────────────────────────

/**
 * Compute category name for a row.
 * Flat conditions (checked first, no threshold):
 *   No record — avgDemand === 0
 *   Ordered   — would be Immediate but suggestedOrder === 0 (incoming covers need)
 * Threshold-based (from SMR_MinStockCategory table):
 *   Immediate — ratio < 0.75
 *   Secondary — ratio < 1.50
 *   Monitoring — ratio < 2.00
 *   Overstocked — ratio >= 2.00 (catch-all)
 */
export function computeCategoryName(
	row: {
		stockCoverCount: number | null | undefined;
		coverageThreshold: number | null | undefined;
		avgDemand: number | null | undefined;
		suggestedOrder: number | null | undefined;
	},
	categories: MinStockCategory[],
	/** Month-to-week factor: 1.0 for monthly, >1 for weekly. */
	displayFactor?: number,
): string | null {
	if (row.avgDemand != null && row.avgDemand === 0) {
		return "No record";
	}
	if (
		!categories.length ||
		row.stockCoverCount == null ||
		row.coverageThreshold == null ||
		row.coverageThreshold <= 0
	) {
		return null;
	}

	const effectiveThreshold =
		displayFactor != null && displayFactor !== 1
			? row.coverageThreshold * displayFactor
			: row.coverageThreshold;
	const ratio = row.stockCoverCount / effectiveThreshold;
	for (const cat of categories) {
		if (cat.threshold != null && ratio < cat.threshold) {
			if (
				cat.category_name === "Immediate" &&
				row.suggestedOrder != null &&
				row.suggestedOrder === 0
			) {
				return "Ordered";
			}
			return cat.category_name;
		}
	}
	return "Overstocked";
}

/** Numeric sort value for period labels like "W1 Jan 2024" or "Jan 2024" */
export function periodSortValue(key: string): number {
	const monthIdx: Record<string, number> = {
		Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
		Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
	};
	const wm = key.match(/^W(\d+)\s+(\w+)\s+(\d+)$/);
	if (wm && wm[2] && wm[3])
		return Number(wm[3]) * 60 + (monthIdx[wm[2]] ?? 0) * 5 + Number(wm[1]);
	const mm = key.match(/^(\w+)\s+(\d+)$/);
	if (mm && mm[1] && mm[2]) return Number(mm[2]) * 12 + (monthIdx[mm[1]] ?? 0);
	return 0;
}

// ─── Form Persistence ─────────────────────────────────────────────────────────

const FORM_STORAGE_KEY = "requirements-form-state-v1";

export interface PersistedFormState {
	mode: Mode;
	selectedPrincipal: Principal | null;
	selectedStorage: StorageLocation[];
	frequency: Frequency;
	demandMode: DemandMode;
	demandSource?: DemandSource;
	dateRange: { from: string | null; to: string | null };
}

export function persistFormState(state: PersistedFormState): void {
	try {
		localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(state));
	} catch {
		/* localStorage full or unavailable */
	}
}

export function loadPersistedForm(): PersistedFormState | null {
	try {
		const raw = localStorage.getItem(FORM_STORAGE_KEY);
		return raw ? (JSON.parse(raw) as PersistedFormState) : null;
	} catch {
		return null;
	}
}

export function serializeDateRange(
	range: { from: Dayjs | null; to: Dayjs | null },
): { from: string | null; to: string | null } {
	return {
		from: range.from?.toISOString() ?? null,
		to: range.to?.toISOString() ?? null,
	};
}


// ─── Date Range Helpers ───────────────────────────────────────────────────────

export interface DateRangeItem {
	from: Dayjs | null;
	to: Dayjs | null;
}

// ─── Group Colors Theme Type ──────────────────────────────────────────────────

export interface GroupColors {
	static: { bg: string };
	demand: { bg: string; color: string };
	computation: { bg: string; color: string };
	stock: { bg: string; color: string };
	inventory: { bg: string; color: string };
	bundling: { bg: string; color: string };
	component: { bg: string; color: string };
	price: { bg: string; color: string };
	finalOrder: { bg: string; color: string };
}

/**
 * Build theme-aware column group colors.
 * Pure function — no hook needed. Called with `darkMode` from useThemeMode().
 */
export function buildGroupColors(darkMode: boolean): GroupColors {
	return {
		static: {
			bg: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
		},
		demand: {
			bg: darkMode ? "rgba(144, 202, 249, 0.10)" : "rgba(33, 150, 243, 0.07)",
			color: darkMode ? "#90caf9" : "#1565c0",
		},
		computation: {
			bg: darkMode ? "rgba(255, 183, 77, 0.10)" : "rgba(255, 152, 0, 0.07)",
			color: darkMode ? "#ffb74d" : "#e65100",
		},
		stock: {
			bg: darkMode ? "rgba(186, 104, 200, 0.10)" : "rgba(156, 39, 176, 0.07)",
			color: darkMode ? "#ce93d8" : "#6a1b9a",
		},
		inventory: {
			bg: darkMode ? "rgba(255, 235, 59, 0.12)" : "rgba(255, 193, 7, 0.10)",
			color: darkMode ? "#fff176" : "#f57f17",
		},
		bundling: {
			bg: darkMode ? "rgba(129, 199, 132, 0.10)" : "rgba(76, 175, 80, 0.07)",
			color: darkMode ? "#81c784" : "#2e7d32",
		},
		component: {
			bg: darkMode ? "rgba(186, 104, 200, 0.10)" : "rgba(156, 39, 176, 0.07)",
			color: darkMode ? "#ce93d8" : "#6a1b9a",
		},
		price: {
			bg: darkMode ? "rgba(129, 199, 132, 0.10)" : "rgba(76, 175, 80, 0.07)",
			color: darkMode ? "#81c784" : "#2e7d32",
		},
		finalOrder: {
			bg: darkMode ? "rgba(186, 104, 200, 0.15)" : "rgba(156, 39, 176, 0.10)",
			color: darkMode ? "#ce93d8" : "#7b1fa2",
		},
	};
}




