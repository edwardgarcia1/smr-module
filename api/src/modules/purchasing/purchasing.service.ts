import { getDb, withDb } from "../../config/db";
import { trimStrings } from "../../utils/trimStrings";
import { BadRequestError } from "../../middlewares/error";
import {
	generatePeriodKeys,
	periodKeyFromParts,
} from "../../utils/periodHelpers";
import {
	buildConversionCache,
	canConvert,
	getConversionFactor,
	normaliseQtyCached,
} from "../../utils/unitConversion";
import { resolveManyMinStock } from "../min-stock/min-stock.service";
import type {
	RequirementItem,
	RequirementsQuery,
} from "./purchasing.schema";

// ─── Constants ────────────────────────────────────────────────────────

const ALLOWED_SITE_IDS = ["MAIN", "CAB", "3MPMT", "3MPGT"];
/** Safety cap — if a principal has more items than this, something is wrong */
const MAX_SALES_ROWS = 100_000;

// ─── SQL clause helpers ───────────────────────────────────────────────

function buildSiteClause(siteIDs: string[]): {
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

function buildDateRangeClause(
	ranges: { start: string; end: string }[],
): { clause: string; params: Record<string, string> } {
	if (!ranges || ranges.length === 0) return { clause: "", params: {} };

	const conditions = ranges.map(
		(_, i) =>
			`(sh.InvcDate >= @dateStart${i} AND sh.InvcDate <= @dateEnd${i})`,
	);
	const params: Record<string, string> = {};
	for (const [i, r] of ranges.entries()) {
		params[`dateStart${i}`] = r.start;
		params[`dateEnd${i}`] = r.end;
	}
	return { clause: `AND (${conditions.join(" OR ")})`, params };
}

// ─── INUnit conversion — imported from shared utils
// buildConversionCache, canConvert, normaliseQtyCached live in ../../utils/unitConversion.ts

// ─── Main ─────────────────────────────────────────────────────────────

export async function getRequirements(
	query: RequirementsQuery,
): Promise<RequirementItem[]> {
	const pool = await getDb();
	const { classID, siteID, dateRanges, frequency } = query;

	const { clause: siteClause, params: siteParams, filteredIDs: siteFilter } =
		buildSiteClause(
			siteID?.filter((s) => ALLOWED_SITE_IDS.includes(s)) ?? [],
		);
	const { clause: dateClause, params: dateParams } =
		buildDateRangeClause(dateRanges);

	// ── Step 1: Aggregated sales query ──────────────────────────────
	// MSSQL 2008-compatible: GROUP BY with YEAR/MONTH instead of DATETRUNC.
	// This reduces rows from 1-per-order-line to 1-per-(InvtID,Unit,month).
	//
	// i.StkUnit is MAX'd (safe — same value for all rows of an InvtID).
	// UnitDesc is kept so we can normalise each group's quantity later.

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
			SUM(sl.QtyShip) AS TotalQtyShip
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
			-- Exclude promo/kit items (items that have Component entries)
			AND NOT EXISTS (SELECT 1 FROM dbo.Component c WHERE c.KitID = i.InvtID)
			${siteClause}
			${dateClause}
		GROUP BY sl.InvtID, sl.UnitDesc, ${groupByPeriod}
		ORDER BY sl.InvtID
	`;

	const salesReq = pool.request().input("classID", classID);
	for (const [k, v] of Object.entries(siteParams)) salesReq.input(k, v);
	for (const [k, v] of Object.entries(dateParams)) salesReq.input(k, v);

	const salesResult = await salesReq.query(salesSql);
	const groups = trimStrings(salesResult.recordset) as Record<string, any>[];

	if (groups.length === 0) return [];

	// ── Step 2: Collect distinct InvtIDs ──────────────────────────
	const invtIDs = [...new Set(groups.map((g) => g.InvtID as string))];

	// ── Step 3: Fetch ItemSite stock levels ───────────────────────
	const siteIDsForStock = siteFilter.length > 0 ? siteFilter : ALLOWED_SITE_IDS;
	const invtPH = invtIDs.map((_, i) => `@invtID${i}`);
	const sitePH = siteIDsForStock.map((_, i) => `@sf${i}`);

	const stockSql = `
		SELECT InvtID, SiteID, QtyOnHand, QtyAvail, QtyOnPO, QtyAlloc
		FROM dbo.ItemSite
		WHERE InvtID IN (${invtPH.join(", ")})
			AND SiteID IN (${sitePH.join(", ")})
	`;
	const stockReq = pool.request();
	for (const [i, id] of invtIDs.entries()) stockReq.input(`invtID${i}`, id);
	for (const [i, sid] of siteIDsForStock.entries())
		stockReq.input(`sf${i}`, sid);

	const stockResult = await stockReq.query(stockSql);
	const stockRows = trimStrings(stockResult.recordset) as Record<string, any>[];

	// Aggregate across sites
	const stockMap = new Map<
		string,
		{ qtyOnHand: number; qtyAvail: number; qtyOnPO: number; qtyAlloc: number }
	>();
	for (const r of stockRows) {
		const id = r.InvtID as string;
		const s = stockMap.get(id) ?? {
			qtyOnHand: 0,
			qtyAvail: 0,
			qtyOnPO: 0,
			qtyAlloc: 0,
		};
		s.qtyOnHand += Number(r.QtyOnHand) || 0;
		s.qtyAvail += Number(r.QtyAvail) || 0;
		s.qtyOnPO += Number(r.QtyOnPO) || 0;
		s.qtyAlloc += Number(r.QtyAlloc) || 0;
		stockMap.set(id, s);
	}

	// ── Step 4: Bulk INUnit conversion cache ──────────────────────
	const convCache = await buildConversionCache(invtIDs);

	// ── Step 5: Resolve min stock (coverage threshold) per item ──
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
	const resolvedMinStocks = await resolveManyMinStock(minStockPairs);
	const coverageMap = new Map<string, number>();
	for (const r of resolvedMinStocks) {
		coverageMap.set(r.invtID, r.minStock);
	}

	// ── Step 6: Validate all unit conversions ─────────────────────
	// Check every unique (InvtID, UnitDesc, StkUnit) triple against the cache.
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

		// Skip when units match or either is empty — no conversion needed
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

	// ── Step 7: Assemble period demand per item ───────────────────
	const periodKeys = generatePeriodKeys(dateRanges, frequency);

	// itemId → { meta, periodDemand: Map<periodKey, total> }
	const demandMap = new Map<
		string,
		{
			descr: string;
			stkUnit: string;
			classID: string;
			periodDemand: Map<string, number>;
			totalNormalised: number;
		}
	>();

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

	// Fill in actual values — each group = (InvtID, UnitDesc, year, month [, week])
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
		if (nq <= 0) continue;

		entry.totalNormalised += nq;
		const cur = entry.periodDemand.get(pk) ?? 0;
		entry.periodDemand.set(pk, cur + nq);
	}

	// ── Step 8: Build response ────────────────────────────────────
	const nPeriods = periodKeys.length || 1;

	// When frequency is "weekly", convert coverageThreshold from months to weeks
	// using the actual period ratio from the selected date range.
	// This preserves the user's intent: minStock=1.2 means "1.2 months of coverage"
	// even when viewing in weekly mode.
	const monthToWeekFactor = (() => {
		if (frequency !== "weekly" || periodKeys.length === 0) return 1.0;
		const uniqueMonths = new Set(
			periodKeys.map((k) => {
				const m = k.match(/W\d+\s+(.+)/);
				return m ? m[1] : k;
			}),
		);
		const nMonths = uniqueMonths.size;
		return nMonths > 0 ? nPeriods / nMonths : 1.0;
	})();

	const results: RequirementItem[] = [];

	for (const [id, entry] of demandMap) {
		const stock = stockMap.get(id) ?? {
			qtyOnHand: 0,
			qtyAvail: 0,
			qtyOnPO: 0,
			qtyAlloc: 0,
		};

		const avgDemand =
			nPeriods > 0
				? Math.round((entry.totalNormalised / nPeriods) * 100) / 100
				: 0;

		const stockCoverCount =
			avgDemand > 0
				? Math.round((stock.qtyAvail / avgDemand) * 100) / 100
				: 0;

		const periodDemandObj: Record<string, number> = {};
		for (const [k, v] of entry.periodDemand) {
			periodDemandObj[k] = Math.round(v * 100) / 100;
		}

		const coverageThreshold = coverageMap.get(id) ?? 1;
		const effectiveThreshold = coverageThreshold * monthToWeekFactor;
		// Stock-aware: how much to bring stock up to (threshold × projected need)
		const targetStock = effectiveThreshold * avgDemand;
		const suggestedOrder = Math.max(
			0,
			Math.round((targetStock - stock.qtyAvail - stock.qtyOnPO) * 100) / 100,
		);

		// Convert to CS (cases) using INUnit cache
		const TARGET_CS = "CS";
		// Qty/CS = stock units per 1 CS (e.g. 24 PCS per CS).
		// INUnit stores CS→PCS = 24, so we ask "CS → StkUnit" to get the factor directly.
		const qtyPerCS = getConversionFactor(convCache, id, TARGET_CS, entry.stkUnit);
		const avgDemandCS = Math.round(
			normaliseQtyCached(convCache, id, avgDemand, entry.stkUnit, TARGET_CS) * 100,
		) / 100;
		const suggestedOrderCS = Math.round(
			normaliseQtyCached(convCache, id, suggestedOrder, entry.stkUnit, TARGET_CS) * 100,
		) / 100;

		results.push({
			invtID: id,
			descr: entry.descr,
			stkUnit: entry.stkUnit,
			classID: entry.classID,
			qtyPerCS,
			qtyOnHand: Math.round(stock.qtyOnHand * 100) / 100,
			qtyAvail: Math.round(stock.qtyAvail * 100) / 100,
			qtyOnPO: Math.round(stock.qtyOnPO * 100) / 100,
			qtyAlloc: Math.round(stock.qtyAlloc * 100) / 100,
			periodDemand: periodDemandObj,
			avgDemand,
			avgDemandCS,
			stockCoverCount,
			coverageThreshold,
			suggestedOrder,
			suggestedOrderCS,
			customOrder: null,
		});
	}

	return results;
}
