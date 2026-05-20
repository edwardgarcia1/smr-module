import { getDb } from "../../config/db";
import { trimStrings } from "../../utils/trimStrings";
import type {
	RequirementItem,
	RequirementsQuery,
} from "./purchasing.schema";

// ─── Constants ────────────────────────────────────────────────────────

const ALLOWED_SITE_IDS = ["MAIN", "CAB", "3MPMT", "3MPGT"];
/** Safety cap — if a principal has more items than this, something is wrong */
const MAX_SALES_ROWS = 100_000;

const MONTH_NAMES = [
	"Jan", "Feb", "Mar", "Apr", "May", "Jun",
	"Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ─── Period label helpers ─────────────────────────────────────────────

function monthLabel(year: number, month: number): string {
	return `${MONTH_NAMES[month - 1]} ${year}`;
}

function weekLabel(year: number, month: number, week: number): string {
	return `W${week} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** Numeric sort key for period labels — ensures chronological order */
function periodSortValue(key: string): number {
	const monthIdx: { [k: string]: number } = {
		Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
		Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
	};
	// "W1 Jan 2026"
	const wm = key.match(/^W(\d+)\s+(\w+)\s+(\d+)$/);
	if (wm && wm[2] && wm[3])
		return Number(wm[3]) * 60 + (monthIdx[wm[2]] ?? 0) * 5 + Number(wm[1]);
	// "Jan 2026"
	const mm = key.match(/^(\w+)\s+(\d+)$/);
	if (mm && mm[1] && mm[2]) return Number(mm[2]) * 12 + (monthIdx[mm[1]] ?? 0);
	return 0;
}

/**
 * Generate all period keys between the date ranges so we can
 * initialise demand maps with zeros (even for periods with no sales).
 */
function generatePeriodKeys(
	ranges: { start: string; end: string }[],
	freq: "weekly" | "monthly",
): string[] {
	const set = new Set<string>();
	for (const r of ranges) {
		const cur = new Date(r.start);
		const end = new Date(r.end);
		while (cur <= end) {
			const y = cur.getFullYear();
			const m = cur.getMonth() + 1;
			if (freq === "monthly") {
				set.add(monthLabel(y, m));
				cur.setMonth(m); // advance to next month
			} else {
				const w = Math.min(Math.ceil(cur.getDate() / 7), 5);
				set.add(weekLabel(y, m, w));
				cur.setDate(cur.getDate() + 7);
			}
		}
	}
	return [...set].sort((a, b) => periodSortValue(a) - periodSortValue(b));
}

/** Group a (year, month, day) triple into the period key */
function periodKeyFromParts(
	y: number,
	m: number,
	d: number,
	freq: "weekly" | "monthly",
): string {
	if (freq === "monthly") return monthLabel(y, m);
	const w = Math.min(Math.ceil(d / 7), 5);
	return weekLabel(y, m, w);
}

// ─── SQL clause helpers ───────────────────────────────────────────────

function buildSiteClause(siteIDs: string[]): {
	clause: string;
	params: Record<string, string>;
} {
	const filtered = (siteIDs ?? []).filter((s) => ALLOWED_SITE_IDS.includes(s));
	if (filtered.length === 0) return { clause: "", params: {} };

	const placeholders = filtered.map((_, i) => `@siteID${i}`);
	const params: Record<string, string> = {};
	filtered.forEach((id, i) => {
		params[`siteID${i}`] = id;
	});
	return { clause: `AND sh.SiteID IN (${placeholders.join(", ")})`, params };
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

// ─── INUnit conversion cache builder ──────────────────────────────────

interface UnitConvRow {
	InvtId: string;
	FromUnit: string;
	ToUnit: string;
	CnvFact: number;
}

/**
 * Fetch ALL conversion rows for the given inventory IDs in a single query.
 * Returns a map keyed by "InvtId|FromUnit|ToUnit" → CnvFact.
 */
async function buildConversionCache(
	invtIDs: string[],
): Promise<Map<string, number>> {
	const cache = new Map<string, number>();
	if (invtIDs.length === 0) return cache;

	const pool = await getDb();
	const placeholders = invtIDs.map((_, i) => `@invt${i}`);
	const sql = `
		SELECT InvtId, FromUnit, ToUnit, CnvFact
		FROM INUnit
		WHERE InvtId IN (${placeholders.join(", ")})
	`;
	const req = pool.request();
	for (const [i, id] of invtIDs.entries()) {
		req.input(`invt${i}`, id);
	}
	const result = await req.query(sql);
	const rows = trimStrings(result.recordset) as UnitConvRow[];
	for (const row of rows) {
		cache.set(`${row.InvtId}|${row.FromUnit}|${row.ToUnit}`, Number(row.CnvFact));
	}
	return cache;
}

/**
 * Look up conversion factor from cache.
 * INUnit stores: 1 FromUnit = CnvFact × ToUnit.
 */
function getCnvFactor(
	cache: Map<string, number>,
	invtID: string,
	fromUnit: string,
	toUnit: string,
): number | null {
	return cache.get(`${invtID}|${fromUnit}|${toUnit}`) ?? null;
}

/**
 * Normalise qty using cached INUnit data.
 * Returns original qty when no conversion is needed or available.
 */
function normaliseQtyCached(
	cache: Map<string, number>,
	invtID: string,
	qty: number,
	fromUnit: string,
	toUnit: string,
): number {
	if (
		!fromUnit ||
		!toUnit ||
		fromUnit.toUpperCase() === toUnit.toUpperCase()
	) {
		return qty;
	}
	// INUnit: 1 FromUnit = CnvFact × ToUnit
	// For QUANTITY conversion (not cost/rate):
	//   Forward: fromUnit→toUnit: qty_toTarget = qty × CnvFact
	//   Reverse: lookup (toUnit→fromUnit): qty_toTarget = qty / revCnvFact
	//
	// Example: 1 CS = 24 PCS (CnvFact=24)
	//   5 CS = 5 × 24 = 120 PCS  (forward: multiply)
	const fwd = getCnvFactor(cache, invtID, fromUnit, toUnit);
	if (fwd !== null && fwd > 0) return qty * fwd;
	// Reverse example: if INUnit has 1 PCS = 0.04167 CS (rev=1/24)
	//   5 CS / 0.04167 ≈ 120 PCS  (reverse: divide)
	const rev = getCnvFactor(cache, invtID, toUnit, fromUnit);
	if (rev !== null && rev > 0) return qty / rev;
	return qty;
}

// ─── Main ─────────────────────────────────────────────────────────────

export async function getRequirements(
	query: RequirementsQuery,
): Promise<RequirementItem[]> {
	const pool = await getDb();
	const { classID, siteID, dateRanges, frequency } = query;

	const { clause: siteClause, params: siteParams } = buildSiteClause(
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
	const invtPH = invtIDs.map((_, i) => `@invtID${i}`);
	const sitePH = ALLOWED_SITE_IDS.map((_, i) => `@sf${i}`);

	const stockSql = `
		SELECT InvtID, SiteID, QtyOnHand, QtyAvail, QtyOnPO, QtyAlloc
		FROM dbo.ItemSite
		WHERE InvtID IN (${invtPH.join(", ")})
			AND SiteID IN (${sitePH.join(", ")})
	`;
	const stockReq = pool.request();
	for (const [i, id] of invtIDs.entries()) stockReq.input(`invtID${i}`, id);
	for (const [i, sid] of ALLOWED_SITE_IDS.entries())
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

	// ── Step 5: Assemble period demand per item ───────────────────
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

	// ── Step 6: Build response ────────────────────────────────────
	const defaultFactor = 1.0;
	const nPeriods = periodKeys.length || 1;
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

		results.push({
			invtID: id,
			descr: entry.descr,
			stkUnit: entry.stkUnit,
			classID: entry.classID,
			qtyOnHand: Math.round(stock.qtyOnHand * 100) / 100,
			qtyAvail: Math.round(stock.qtyAvail * 100) / 100,
			qtyOnPO: Math.round(stock.qtyOnPO * 100) / 100,
			qtyAlloc: Math.round(stock.qtyAlloc * 100) / 100,
			periodDemand: periodDemandObj,
			avgDemand,
			stockCoverCount,
			monthlyFactor: defaultFactor,
			suggestedOrder: Math.round(avgDemand * defaultFactor * 100) / 100,
			customOrder: null,
		});
	}

	return results;
}
