// ─── Shared Sales Service ────────────────────────────────────────────
// Extracted from purchasing.service.ts and bundling.service.ts
// Contains common helpers for sales query building, stock fetching,
// unit conversion validation, min stock resolution, and period demand assembly.

import type sql from "mssql";
import type { DateRange } from "./date-utils";
import { trimStrings } from "../utils/trimStrings";
import { BadRequestError } from "../middlewares/error";
import { generatePeriodKeys, periodKeyFromParts } from "../utils/periodHelpers";
import { buildConversionCache, canConvert, normaliseQtyCached } from "../utils/unitConversion";
import { resolveManyMinStock } from "../modules/min-stock/min-stock.service";

// ─── Constants ───────────────────────────────────────────────────────

export const ALLOWED_SITE_IDS = ["MAIN", "CAB", "3MPMT", "3MPGT"];
export const MAX_SALES_ROWS = 100_000;

// ─── Re-exports from other modules ───────────────────────────────────
// These are re-exported so callers have a single import point for
// the most common sales-service dependencies.

export { buildConversionCache, canConvert, normaliseQtyCached, getConversionFactor } from "../utils/unitConversion";
export { generatePeriodKeys, periodKeyFromParts } from "../utils/periodHelpers";

// ─── Sales Query Types ───────────────────────────────────────────────

export type { DateRange } from "./date-utils";

export interface SalesQueryParams {
	classID: string;
	siteID?: string[];
	dateRange: DateRange;
	frequency: "weekly" | "monthly";
	demandSource?: "shipped" | "ordered";
	/** SQL fragment to add after the main WHERE conditions.
	 *  Use for e.g. "AND NOT EXISTS (...)" or "AND EXISTS (...)" filter. */
	itemFilterSQL?: string;
}

export interface StockLevels {
	qtyOnHand: number;
	qtyAvail: number;
	qtyOnPO: number;
	qtyAlloc: number;
}

export interface SalesGroup {
	InvtID: string;
	InventoryDescr: string;
	StkUnit: string;
	ClassID: string;
	UnitDesc: string;
	SaleYear: number;
	SaleMonth: number;
	SaleWeek: number;
	TotalQtyShip: number;
	[key: string]: any;
}

export interface DemandEntry {
	descr: string;
	stkUnit: string;
	classID: string;
	periodDemand: Map<string, number>;
	totalNormalised: number;
}

// ─── SQL Clause Builders ─────────────────────────────────────────────

export function buildSiteClause(siteIDs: string[]): {
	clause: string;
	params: Record<string, string>;
	filteredIDs: string[];
} {
	const filtered = (siteIDs ?? []).filter((s) => ALLOWED_SITE_IDS.includes(s));
	if (filtered.length === 0) {
		return { clause: "", params: {}, filteredIDs: [] };
	}

	const placeholders = filtered.map((_, i) => `@siteID${i}`);
	const params: Record<string, string> = {};
	filtered.forEach((id, i) => {
		params[`siteID${i}`] = id;
	});
	return {
		clause: `AND sh.SiteID IN (${placeholders.join(", ")})`,
		params,
		filteredIDs: filtered,
	};
}

export function buildDateRangeClause(
	range: DateRange,
): { clause: string; params: Record<string, string> } {
	return {
		clause: "AND (sh.InvcDate >= @dateStart AND sh.InvcDate <= @dateEnd)",
		params: { dateStart: range.start, dateEnd: range.end },
	};
}

// ─── Stock Fetching ──────────────────────────────────────────────────

export async function fetchStockLevels(
	invtIDs: string[],
	siteIDs: string[],
	pool: sql.ConnectionPool,
): Promise<Map<string, StockLevels>> {
	if (invtIDs.length === 0) return new Map();

	const invtPH = invtIDs.map((_, i) => `@invtID${i}`);
	const sitePH = siteIDs.map((_, i) => `@sf${i}`);

	const stockSql = `
		SELECT InvtID, SiteID, QtyOnHand, QtyAvail, QtyOnPO, QtyAlloc
		FROM dbo.ItemSite
		WHERE InvtID IN (${invtPH.join(", ")})
			AND SiteID IN (${sitePH.join(", ")})
	`;
	const stockReq = pool.request();
	for (const [i, id] of invtIDs.entries()) stockReq.input(`invtID${i}`, id);
	for (const [i, sid] of siteIDs.entries()) stockReq.input(`sf${i}`, sid);

	const stockResult = await stockReq.query(stockSql);
	const stockRows = trimStrings(stockResult.recordset) as Record<string, any>[];

	const map = new Map<string, StockLevels>();
	for (const r of stockRows) {
		const invtId = r.InvtID as string;
		const s = map.get(invtId) ?? {
			qtyOnHand: 0,
			qtyAvail: 0,
			qtyOnPO: 0,
			qtyAlloc: 0,
		};
		s.qtyOnHand += Number(r.QtyOnHand) || 0;
		s.qtyAvail += Number(r.QtyAvail) || 0;
		s.qtyOnPO += Number(r.QtyOnPO) || 0;
		s.qtyAlloc += Number(r.QtyAlloc) || 0;
		map.set(invtId, s);
	}
	return map;
}

// ─── Sales Query Execution ───────────────────────────────────────────

/**
 * Builds and executes the aggregated sales query.
 * The `itemFilterSQL` parameter allows callers to add an EXISTS/NOT EXISTS
 * filter to include or exclude promo/kit items.
 */
export async function executeSalesQuery(
	params: SalesQueryParams,
	pool: sql.ConnectionPool,
): Promise<{ groups: SalesGroup[]; siteFilter: string[] }> {
	const {
		classID,
		siteID,
		dateRange,
		frequency,
		demandSource,
		itemFilterSQL,
	} = params;

	const { clause: siteClause, params: siteParams, filteredIDs: siteFilter } =
		buildSiteClause(
			siteID?.filter((s) => ALLOWED_SITE_IDS.includes(s)) ?? [],
		);
	const { clause: dateClause, params: dateParams } =
		buildDateRangeClause(dateRange);

	const groupByPeriod =
		frequency === "monthly"
			? "YEAR(sh.InvcDate), MONTH(sh.InvcDate)"
			: "YEAR(sh.InvcDate), MONTH(sh.InvcDate), (DAY(sh.InvcDate) - 1) / 7 + 1";

	const periodSelect =
		frequency === "monthly"
			? "YEAR(sh.InvcDate) AS SaleYear, MONTH(sh.InvcDate) AS SaleMonth, 0 AS SaleWeek"
			: "YEAR(sh.InvcDate) AS SaleYear, MONTH(sh.InvcDate) AS SaleMonth, (DAY(sh.InvcDate) - 1) / 7 + 1 AS SaleWeek";

	const salesSql = `
		SELECT TOP ${MAX_SALES_ROWS}
			sl.InvtID,
			MAX(i.Descr) AS InventoryDescr,
			MAX(i.StkUnit) AS StkUnit,
			MAX(i.ClassID) AS ClassID,
			sl.UnitDesc,
			${periodSelect},
			SUM(CASE WHEN @demandSource = 'ordered' THEN sl.QtyOrd ELSE sl.QtyShip END) AS TotalQtyShip
		FROM dbo.SOShipLine AS sl
		LEFT JOIN dbo.SOShipHeader AS sh
			ON sl.ShipperID = sh.ShipperID
		LEFT JOIN dbo.Inventory AS i
			ON sl.InvtID = i.InvtID
		WHERE sh.Cancelled = 0
			AND sh.ARBatNbr <> ''
			AND sh.InvcNbr <> ''
			AND sh.SOTypeID IN ('BS','XX','EM','BN','VS','ER','BEP','BEX','EVE','EVX','RD','DX','OS','OX','XS','OR')
			AND sl.CpnyID <> ''
			AND sh.InvcDate >= CONVERT(DATETIME, '2025-01-01 00:00:00', 102)
			AND i.ClassID = @classID
			${itemFilterSQL ?? ""}
			${siteClause}
			${dateClause}
		GROUP BY sl.InvtID, sl.UnitDesc, ${groupByPeriod}
		ORDER BY sl.InvtID
	`;

	const salesReq = pool.request()
		.input("classID", classID)
		.input("demandSource", demandSource ?? "shipped");
	for (const [k, v] of Object.entries(siteParams)) salesReq.input(k, v);
	for (const [k, v] of Object.entries(dateParams)) salesReq.input(k, v);

	const salesResult = await salesReq.query(salesSql);
	return {
		groups: trimStrings(salesResult.recordset) as SalesGroup[],
		siteFilter,
	};
}

// ─── Conversion Validation ───────────────────────────────────────────

export function validateConversions(
	groups: SalesGroup[],
	convCache: Map<string, number>,
): void {
	const conversionFailures: {
		invtID: string;
		descr: string;
		unitDesc: string;
		stkUnit: string;
	}[] = [];
	const seenPairs = new Set<string>();

	for (const g of groups) {
		const invtID = g.InvtID as string;
		const unitDesc = (g.UnitDesc as string) ?? "";
		const stkUnit = (g.StkUnit as string) ?? "";
		const descr = (g.InventoryDescr as string) ?? "";

		if (
			!unitDesc ||
			!stkUnit ||
			unitDesc.toUpperCase() === stkUnit.toUpperCase()
		) {
			continue;
		}

		const pairKey = `${invtID}|${unitDesc}->${stkUnit}`;
		if (seenPairs.has(pairKey)) continue;
		seenPairs.add(pairKey);

		if (!canConvert(convCache, invtID, unitDesc, stkUnit)) {
			conversionFailures.push({ invtID, descr, unitDesc, stkUnit });
		}
	}

	if (conversionFailures.length > 0) {
		const lines = conversionFailures
			.map(
				(f) =>
					`• ${f.invtID} — "${f.descr}" — ships in "${f.unitDesc}" but stock unit is "${f.stkUnit}" — no conversion factor found in INUnit`,
			)
			.join("\n");
		const unitDescSet = [
			...new Set(conversionFailures.map((f) => f.unitDesc)),
		].join("/");
		const stkUnitSet = [
			...new Set(conversionFailures.map((f) => f.stkUnit)),
		].join(", ");
		throw new BadRequestError(
			`Unit conversion is not possible for the following items:\n${lines}\n\n` +
				`Add missing conversion factors to the INUnit table so that ${unitDescSet} can be converted to ${stkUnitSet}.`,
		);
	}
}

// ─── Min Stock Resolution ────────────────────────────────────────────

export async function resolveCoverageThresholds(
	groups: SalesGroup[],
	invtIDs: string[],
	tenantKey: string,
): Promise<Map<string, number>> {
	const invtClassMap = new Map<string, string>();
	for (const g of groups) {
		const id = g.InvtID as string;
		const cid = g.ClassID as string;
		if (!invtClassMap.has(id)) invtClassMap.set(id, cid);
	}
	const minStockPairs = invtIDs.map((id) => ({
		invtID: id,
		classID: invtClassMap.get(id) ?? "",
	}));
	const resolvedMinStocks = await resolveManyMinStock(minStockPairs, tenantKey);
	const coverageMap = new Map<string, number>();
	for (const r of resolvedMinStocks) {
		coverageMap.set(r.invtID, r.minStock);
	}
	return coverageMap;
}

// ─── Period Demand Assembly ──────────────────────────────────────────

export function buildDemandMap(
	groups: SalesGroup[],
	periodKeys: string[],
	frequency: "weekly" | "monthly",
	convCache: Map<string, number>,
): Map<string, DemandEntry> {
	const demandMap = new Map<string, DemandEntry>();

	// Initialise every item with zero-filled periods
	for (const g of groups) {
		const id = g.InvtID as string;
		if (!demandMap.has(id)) {
			const pd = new Map<string, number>();
			for (const pk of periodKeys) pd.set(pk, 0);
			demandMap.set(id, {
				descr: (g.InventoryDescr as string) ?? "",
				stkUnit: (g.StkUnit as string) ?? "",
				classID: (g.ClassID as string) ?? "",
				periodDemand: pd,
				totalNormalised: 0,
			});
		}
	}

	// Fill in actual values
	for (const g of groups) {
		const id = g.InvtID as string;
		const entry = demandMap.get(id);
		if (!entry) continue;

		const rawQty = Number(g.TotalQtyShip) || 0;
		const unitDesc = (g.UnitDesc as string) ?? "";
		const stkUnit = entry.stkUnit;
		const year = Number(g.SaleYear);
		const month = Number(g.SaleMonth);
		const day = frequency === "weekly" ? (Number(g.SaleWeek) - 1) * 7 + 1 : 1;
		const pk = periodKeyFromParts(year, month, day, frequency);

		const nq = normaliseQtyCached(convCache, id, rawQty, unitDesc, stkUnit);
		if (nq === 0) continue;

		entry.totalNormalised += nq;
		const cur = entry.periodDemand.get(pk) ?? 0;
		entry.periodDemand.set(pk, cur + nq);
	}

	return demandMap;
}

// ─── Average Demand Computation ──────────────────────────────────────

export function computeAvgDemand(
	totalNormalised: number,
	nPeriods: number,
	frequency: "weekly" | "monthly",
	validDays?: number,
	demandMode?: "average" | "highest",
	periodDemand?: Map<string, number>,
): number {
	if (demandMode === "highest" && periodDemand && periodDemand.size > 0) {
		return Math.round(Math.max(...Array.from(periodDemand.values())) * 100) / 100;
	}

	if (frequency === "weekly" && validDays != null && validDays > 0) {
		return Math.round((totalNormalised / validDays) * 6 * 100) / 100;
	}

	return nPeriods > 0
		? Math.round((totalNormalised / nPeriods) * 100) / 100
		: 0;
}

export function computeMonthToWeekFactor(
	frequency: "weekly" | "monthly",
	periodKeys: string[],
	validDays?: number,
): number {
	if (frequency !== "weekly" || periodKeys.length === 0) return 1.0;
	const uniqueMonths = new Set(
		periodKeys.map((k) => {
			const m = k.match(/W\d+\s+(.+)/);
			return m ? m[1] : k;
		}),
	);
	const nMonths = uniqueMonths.size;
	if (nMonths === 0) return 1.0;
	return (validDays! / 6) / nMonths;
}

export function computeStockCoverCount(avgDemand: number, qtyAvail: number): number {
	return avgDemand > 0
		? Math.round((qtyAvail / avgDemand) * 100) / 100
		: 0;
}

export function round2(n: number): number {
	return Math.round(n * 100) / 100;
}
