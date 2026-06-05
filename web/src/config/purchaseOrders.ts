/**
 * Purchase Orders feature: types, constants, column config, and pure utilities.
 * Extracted from the monolithic PurchaseOrders.tsx.
 */

// ─── Types ────────────────────────────────────────────────────────────

export type PoStatus = "Pending" | "Printed" | "Approved" | "Encoded" | "Cancelled";
export const PO_STATUSES: PoStatus[] = ["Pending", "Printed", "Approved", "Encoded", "Cancelled"];

export interface PurchaseOrder {
	id: number;
	ref_num: string;
	principal_id: string;
	site_id: string;
	demand_mode: string;
	frequency: string;
	sales_from: string;
	sales_to: string;
	csv_filename: string | null;
	created_at: string;
	created_by: string;
	last_update_at: string | null;
	last_update_by: string | null;
	status: PoStatus;
	status_from: string | null;
	status_by: string | null;
}

export interface PurchaseOrderDetail {
	meta: PurchaseOrder;
	csvData: {
		headers: string[];
		rows: Record<string, string>[];
	};
}

export type Order = "asc" | "desc";
export type OrderBy = keyof PurchaseOrder;

export const PAGE_SIZE_OPTIONS = [10, 20, 50];

export interface HeadCell {
	id: OrderBy;
	label: string;
}

export const LIST_HEAD_CELLS: HeadCell[] = [
	{ id: "ref_num", label: "Ref Nbr" },
	{ id: "principal_id", label: "Principal" },
	{ id: "site_id", label: "Site(s)" },
	{ id: "demand_mode", label: "Demand Mode" },
	{ id: "frequency", label: "Frequency" },
	{ id: "status", label: "Status" },
	{ id: "created_by", label: "Created By" },
	{ id: "last_update_at", label: "Last Updated" },
	{ id: "last_update_by", label: "Updated By" },
	{ id: "created_at", label: "Created" },
];

// ─── Detail grid column width/label maps (matching RequirementsPage) ──

export const DETAIL_COL_WIDTHS: Record<string, number> = {
	invtID: 110,
	descr: 260,
	stkUnit: 90,
	qtyPerCS: 90,
	price_ao: 150,
	price_perCS: 110,
	price_perStkUnit: 110,
	qtyOnHand: 110,
	qtyAvail: 110,
	qtyOnPO: 110,
	qtyAlloc: 110,
	avgDemand: 150,
	avgDemandCS: 120,
	totalDemandCS: 110,
	stockCoverCount: 130,
	coverageThreshold: 100,
	suggestedOrder: 180,
	suggestedOrderCS: 130,
	customOrder: 130,
	amount: 130,
	finalOrderCS: 130,
	orderCover: 130,
	incomingCover: 130,
	totalCover: 140,
	totalDemand: 110,
};

export const DETAIL_HEADER_LABELS: Record<string, string> = {
	invtID: "Inventory ID",
	descr: "Description",
	stkUnit: "Stock Unit",
	qtyPerCS: "Qty/CS",
	price_ao: "Last Update",
	price_perCS: "Per CS",
	price_perStkUnit: "Per StkUnit",
	qtyOnHand: "On Hand",
	qtyAvail: "Available",
	qtyOnPO: "Incoming",
	qtyAlloc: "Unreleased",
	avgDemand: "Avg Demand",
	avgDemandCS: "Avg Demand (CS)",
	totalDemandCS: "Total (CS)",
	stockCoverCount: "Stock Cover",
	coverageThreshold: "Min Stock",
	suggestedOrder: "Suggested Order",
	suggestedOrderCS: "Suggested Order (CS)",
	customOrder: "Custom Order (CS)",
	amount: "Amount",
	finalOrderCS: "Final Order (CS)",
	orderCover: "Order Cover",
	incomingCover: "Incoming Cover",
	totalCover: "Total Cover",
	totalDemand: "Total",
	_category: "Category",
};

export const DETAIL_COL_ORDER: string[] = [
	"invtID",
	"descr",
	"stkUnit",
	"qtyPerCS",
	"price_ao",
	"price_perCS",
	"price_perStkUnit",
	"qtyAlloc",
	"qtyOnPO",
	"qtyOnHand",
	"qtyAvail",
	"totalDemand",
	"totalDemandCS",
	"avgDemand",
	"avgDemandCS",
	"stockCoverCount",
	"coverageThreshold",
	"suggestedOrder",
	"suggestedOrderCS",
	"customOrder",
	"finalOrderCS",
	"orderCover",
	"incomingCover",
	"totalCover",
	"amount",
	"_category",
];

export const DETAIL_NUMERIC_FIELDS = new Set([
	"qtyPerCS",
	"price_perCS",
	"price_perStkUnit",
	"qtyOnHand",
	"qtyAvail",
	"qtyOnPO",
	"qtyAlloc",
	"totalDemand",
	"totalDemandCS",
	"avgDemand",
	"avgDemandCS",
	"stockCoverCount",
	"coverageThreshold",
	"suggestedOrder",
	"suggestedOrderCS",
	"customOrder",
	"amount",
	"finalOrderCS",
	"orderCover",
	"incomingCover",
	"totalCover",
]);

export const DETAIL_HEADER_GROUPS: Record<string, string> = {
	invtID: "group-static",
	descr: "group-static",
	stkUnit: "group-static",
	qtyPerCS: "group-static",
	price_ao: "group-price",
	price_perCS: "group-price",
	price_perStkUnit: "group-price",
	qtyAlloc: "group-inventory",
	qtyOnPO: "group-inventory",
	qtyOnHand: "group-inventory",
	qtyAvail: "group-inventory",
	totalDemand: "group-computation",
	totalDemandCS: "group-computation",
	avgDemand: "group-computation",
	avgDemandCS: "group-computation",
	stockCoverCount: "group-computation",
	coverageThreshold: "group-stock",
	suggestedOrder: "group-stock",
	suggestedOrderCS: "group-stock",
	customOrder: "group-stock",
	finalOrderCS: "group-final-order",
	orderCover: "group-stock",
	incomingCover: "group-stock",
	totalCover: "group-stock",
	amount: "group-stock",
};

// ─── Status chip color map ─────────────────────────────────────────────

export const STATUS_CHIP_COLORS: Record<string, Record<string, string>> = {
	Pending: { bg: "warning.soft", color: "warning.dark" },
	Printed: { bg: "info.soft", color: "info.dark" },
	Approved: { bg: "success.soft", color: "success.dark" },
	Encoded: { bg: "secondary.soft", color: "secondary.dark" },
	Cancelled: { bg: "error.soft", color: "error.dark" },
};

// ─── Pure utility functions ────────────────────────────────────────────

export function formatDate(dateStr: string): string {
	if (!dateStr) return "—";
	try {
		return new Date(dateStr).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	} catch {
		return dateStr;
	}
}

export function formatDateTime(dateStr: string): string {
	if (!dateStr) return "—";
	try {
		return new Date(dateStr).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return dateStr;
	}
}

export function capitalize(str: string): string {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
