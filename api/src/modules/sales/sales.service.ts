import { getDb } from "../../config/db";
import { trimStrings } from "../../utils/trimStrings";
import type { DateRange, PaginatedResponse, SalesFilter, SalesRecord } from "./sales.schema";

// ─── Constants ────────────────────────────────────────────────────────

/** Max rows per page */
const MAX_LIMIT = 10_000;

/** Default rows per page */
const DEFAULT_LIMIT = 500;

// ─── Helpers ──────────────────────────────────────────────────────────

/** MSSQL 2008-compatible dbo.SplitItem replacement */
function splitItem(
	str: string | null | undefined,
	delimiter: string,
	index: number,
): string {
	const parts = (str ?? "").split(delimiter);
	return parts[index] ?? "";
}

/** Map HeaderUser7 to company name */
function mapCompany(headerUser7: string | null | undefined): string {
	switch (headerUser7) {
		case "1":
			return "MARYLAND";
		case "2":
			return "RHEINLAND";
		case "3":
			return "MOMENTUM";
		default:
			return "NO_COMP";
	}
}

/** Normalise ShiptoID — DEFAULT2/3 → DEFAULT1 */
function mapShipToID(shiptoID: string | null | undefined): string {
	if (shiptoID === "DEFAULT2" || shiptoID === "DEFAULT3") return "DEFAULT1";
	return shiptoID ?? "";
}

/** Calculate unserved quantity */
function calcUnservedQty(qtyShip: number, qtyOrd: number): number {
	return qtyShip < 0 ? qtyOrd + qtyShip : qtyOrd - qtyShip;
}

/** Calculate OTD in days */
function calcOTD(crtdDateTime: string | Date, invcDate: string | Date): number {
	const created = new Date(crtdDateTime);
	const delivered = new Date(invcDate);
	return Math.round((delivered.getTime() - created.getTime()) / 86_400_000);
}

/**
 * Format a DB date value as `YYYY-MM-DD` using the server's local
 * timezone (PH = UTC+8). Preserves the exact date as stored — no UTC shifting.
 */
function formatDateLocal(value: unknown): string {
	if (value instanceof Date && !isNaN(value.getTime())) {
		const y = value.getFullYear();
		const m = String(value.getMonth() + 1).padStart(2, "0");
		const d = String(value.getDate()).padStart(2, "0");
		return `${y}-${m}-${d}`;
	}
	if (typeof value === "string") return value;
	return "";
}

// ─── SQL parts (shared by count + data queries) ───────────────────────

const BASE_FROM = `
FROM dbo.SOShipLine AS sl
LEFT JOIN dbo.SOShipHeader AS sh
    ON sl.ShipperID = sh.ShipperID
LEFT JOIN dbo.ReasonCode AS rc
    ON sl.User7 = rc.ReasonCD
LEFT JOIN dbo.SOAddress AS sa
    ON sh.CustID = sa.CustId AND sh.ShiptoID = sa.ShipToId
LEFT JOIN dbo.zProvinces AS zp
    ON sa.TaxLocId = zp.PROVINCE
LEFT JOIN dbo.Customer AS c
    ON sh.CustID = c.CustId
LEFT JOIN dbo.Inventory AS i
    ON sl.InvtID = i.InvtID
LEFT JOIN dbo.ProductClass AS pc
    ON i.ClassID = pc.ClassID
LEFT JOIN dbo.ProdMgr AS pm
    ON i.ProdMgrID = pm.ProdMgrID
WHERE sh.Cancelled = 0
  AND sh.ARBatNbr <> ''
  AND sh.InvcNbr <> ''
  AND sh.SOTypeID IN ('BS','XX','EM','BN','VS','ER','BEP','BEX','EVE','EVX','RD','DX','OS','OX','XS','OR')
  AND sl.CpnyID <> ''
  AND sh.InvcDate >= CONVERT(DATETIME, '2025-01-01 00:00:00', 102)
  {DATE_RANGES}
  {FILTERS}`;

const COLUMNS = `
    sh.ShipperID, sh.OrdNbr, sh.OrdDate, sh.InvcDate, sh.InvcNbr,
    i.ProdMgrID, i.ClassID, pc.Descr AS ClassDescr,
    sh.CustID, sh.ShiptoID, c.BillName, sh.ShipName, sh.CustOrdNbr,
    sl.InvtID, i.Descr AS InventoryDescr,
    sl.QtyOrd, sl.QtyShip, sl.SlsPrice, sl.ChainDisc, sl.DiscPct,
    sl.TotInvc, sl.CnvFact, sl.UnitDesc,
    sh.BillAddr1, sh.BillAddr2, sh.BillCity,
    sh.ShipAddr1, sh.ShipAddr2, sh.ShipCity,
    sh.User9, sh.SOTypeID, sh.SiteID, sh.User7 AS HeaderUser7,
    c.ClassId AS CustClassId, c.User5, sl.LineRef, c.PriceClassID,
    sh.SlsperID, sl.User7 AS LineUser7, sh.ShipViaID,
    rc.Descr AS ReasonDescr, pm.Descr AS SubClassDescr,
    sh.INBatNbr, sl.TotCost, sl.Cost, sh.User1,
    zp.PROVINCE, zp.DIVISION, sh.Crtd_DateTime`;

// ─── SQL builder ──────────────────────────────────────────────────────

function buildDateRangeClause(ranges: DateRange[]): {
	clause: string;
	params: Record<string, string>;
} {
	if (!ranges || ranges.length === 0) return { clause: "", params: {} };

	const conditions = ranges.map(
		(_, i) => `(sh.InvcDate >= @dateStart${i} AND sh.InvcDate <= @dateEnd${i})`,
	);

	const params: Record<string, string> = {};
	for (const [i, r] of ranges.entries()) {
		params[`dateStart${i}`] = r.start;
		params[`dateEnd${i}`] = r.end;
	}

	return {
		clause: `AND (${conditions.join(" OR ")})`,
		params,
	};
}

function buildFilterClause(filter?: SalesFilter): {
	clause: string;
	params: Record<string, string>;
} {
	if (!filter) return { clause: "", params: {} };

	const parts: string[] = [];
	const params: Record<string, string> = {};

	if (filter.siteID) {
		parts.push("sh.SiteID = @siteID");
		params.siteID = filter.siteID;
	}
	if (filter.priceClassID) {
		parts.push("c.PriceClassID = @priceClassID");
		params.priceClassID = filter.priceClassID;
	}
	if (filter.classID) {
		parts.push("i.ClassID = @classID");
		params.classID = filter.classID;
	}

	if (parts.length === 0) return { clause: "", params: {} };

	return {
		clause: `AND ${parts.join(" AND ")}`,
		params,
	};
}

function buildCountSql(
	dateRanges: DateRange[],
	filter?: SalesFilter,
): {
	sql: string;
	params: Record<string, string>;
} {
	const { clause: dateClause, params: dateParams } = buildDateRangeClause(dateRanges);
	const { clause: filterClause, params: filterParams } = buildFilterClause(filter);

	let sql = BASE_FROM.replace("{DATE_RANGES}", dateClause);
	sql = sql.replace("{FILTERS}", filterClause);

	return {
		sql: `SELECT COUNT(*) AS _total ${sql}`,
		params: { ...dateParams, ...filterParams },
	};
}

function buildDataSql(
	dateRanges: DateRange[],
	offset: number,
	limit: number,
	filter?: SalesFilter,
): { sql: string; params: Record<string, string> } {
	const { clause: dateClause, params: dateParams } = buildDateRangeClause(dateRanges);
	const { clause: filterClause, params: filterParams } = buildFilterClause(filter);

	let fromClause = BASE_FROM.replace("{DATE_RANGES}", dateClause);
	fromClause = fromClause.replace("{FILTERS}", filterClause);

	// MSSQL 2008-compatible pagination via ROW_NUMBER
	const sql = `
SELECT * FROM (
    SELECT ROW_NUMBER() OVER (ORDER BY sh.InvcDate DESC, sh.ShipperID) AS _row_num,
        ${COLUMNS}
    ${fromClause}
) AS _paginated
WHERE _row_num BETWEEN @_offset + 1 AND @_offset + @_limit
ORDER BY _row_num`;

	return {
		sql,
		params: { ...dateParams, ...filterParams, _offset: String(offset), _limit: String(limit) },
	};
}

// ─── Row transformer ──────────────────────────────────────────────────

function transformRow(row: Record<string, any>): SalesRecord {
	const qtyShip = Number(row.QtyShip) || 0;
	const qtyOrd = Number(row.QtyOrd) || 0;
	const slsPrice = Number(row.SlsPrice) || 0;
	const discPct = Number(row.DiscPct) || 0;
	const gross = qtyShip * slsPrice;
	const discAmt = gross * (discPct / 100);
	const unservedQty = calcUnservedQty(qtyShip, qtyOrd);

	return {
		shipperID: row.ShipperID ?? "",
		ordNbr: row.OrdNbr ?? "",
		ordDate: formatDateLocal(row.OrdDate),
		deliveryDate: formatDateLocal(row.InvcDate),
		invcNbr: row.InvcNbr ?? "",
		prodMgrID: row.ProdMgrID ?? "",
		classID: row.ClassID ?? "",
		classDescr: row.ClassDescr ?? "",
		custID: row.CustID ?? "",
		shiptoID: row.ShiptoID ?? "",
		billName: row.BillName ?? "",
		shipName: row.ShipName ?? "",
		poNumber: row.CustOrdNbr ?? "",
		invtID: row.InvtID ?? "",
		descr: row.InventoryDescr ?? "",
		qtyOrd,
		qtyShip,
		slsPrice,
		chainDisc: row.ChainDisc ?? "",
		discPct,
		discAmt: Math.round(discAmt * 100) / 100,
		gross: Math.round(gross * 100) / 100,
		totInvc: Number(row.TotInvc) || 0,
		cnvFact: Number(row.CnvFact) || 1,
		unitDesc: row.UnitDesc ?? "",
		billAddr1: row.BillAddr1 ?? "",
		billAddr2: row.BillAddr2 ?? "",
		billCity: row.BillCity ?? "",
		shipAddr1: row.ShipAddr1 ?? "",
		shipAddr2: row.ShipAddr2 ?? "",
		shipCity: row.ShipCity ?? "",
		docDate: formatDateLocal(row.User9),
		soTypeID: row.SOTypeID ?? "",
		siteID: row.SiteID ?? "",
		company: mapCompany(row.HeaderUser7),
		custClassID: row.CustClassId ?? "",
		slsShipToID: mapShipToID(row.ShiptoID),
		kob: row.User5 ?? "",
		lineRef: row.LineRef ?? "",
		priceClassID: row.PriceClassID ?? "",
		slsperID: row.SlsperID ?? "",
		reasonCode: row.LineUser7 ?? "",
		shipViaID: row.ShipViaID ?? "",
		reasonDescr: row.ReasonDescr ?? "",
		subClassDescr: row.SubClassDescr ?? "",
		inBatNbr: row.INBatNbr ?? "",
		totCost: Number(row.TotCost) || 0,
		cost: Number(row.Cost) || 0,
		unservedQty,
		unservedAmt: Math.round(slsPrice * unservedQty * 100) / 100,
		sprNo: row.User1 ?? "",
		province: row.PROVINCE ?? "",
		division: row.DIVISION ?? "",
		otd: calcOTD(row.Crtd_DateTime, row.InvcDate),
		soDate: formatDateLocal(row.Crtd_DateTime),
		item1: splitItem(row.ChainDisc, ",", 0),
		item2: splitItem(row.ChainDisc, ",", 1),
		item3: splitItem(row.ChainDisc, ",", 2),
		item4: splitItem(row.ChainDisc, ",", 3),
		item5: splitItem(row.ChainDisc, ",", 4),
	};
}

// ─── Exported API ─────────────────────────────────────────────────────

export { MAX_LIMIT, DEFAULT_LIMIT };

/**
 * Fetch paginated sales records with optional date-range and field filtering.
 *
 * @param page     Page number (1-based).
 * @param limit    Rows per page (capped at MAX_LIMIT).
 * @param dateRanges  Optional date-range pairs. Supports gaps.
 * @param filter   Optional filters (siteID, priceClassID, classID).
 */
export async function getSales(
	page: number,
	limit: number,
	dateRanges?: DateRange[],
	filter?: SalesFilter,
): Promise<PaginatedResponse<SalesRecord>> {
	const pool = await getDb();

	// Run count + data in parallel
	const [countResult, dataResult] = await Promise.all([
		runCount(pool, dateRanges, filter),
		runData(pool, page, limit, dateRanges, filter),
	]);

	const total = countResult;
	const data = dataResult;

	return {
		data,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit) || 1,
	};
}

async function runCount(
	pool: Awaited<ReturnType<typeof getDb>>,
	dateRanges?: DateRange[],
	filter?: SalesFilter,
): Promise<number> {
	const { sql, params } = buildCountSql(dateRanges ?? [], filter);
	const request = pool.request();

	for (const [key, val] of Object.entries(params)) {
		request.input(key, val);
	}

	const result = await request.query(sql);
	return Number(result.recordset[0]?._total) || 0;
}

async function runData(
	pool: Awaited<ReturnType<typeof getDb>>,
	page: number,
	limit: number,
	dateRanges?: DateRange[],
	filter?: SalesFilter,
): Promise<SalesRecord[]> {
	const offset = (page - 1) * limit;
	const { sql, params } = buildDataSql(dateRanges ?? [], offset, limit, filter);
	const request = pool.request();

	for (const [key, val] of Object.entries(params)) {
		request.input(key, val);
	}

	const result = await request.query(sql);
	const rows = trimStrings(result.recordset as Record<string, any>[]);
	return rows.map(transformRow);
}
