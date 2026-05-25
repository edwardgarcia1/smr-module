import { getDb } from "../../config/db";
import { trimStrings } from "../../utils/trimStrings";
import { BadRequestError } from "../../middlewares/error";
import {
	generatePeriodKeys,
	periodKeyFromParts,
} from "../../utils/periodHelpers";
import {
	buildConversionCache,
	canConvert,
	normaliseQtyCached,
} from "../../utils/unitConversion";
import { resolveManyMinStock } from "../min-stock/min-stock.service";
import type {
	BundlingItem,
	BundlingQuery,
	ComponentStock,
} from "./bundling.schema";

// ─── Constants ────────────────────────────────────────────────────────

const ALLOWED_SITE_IDS = ["MAIN", "CAB", "3MPMT", "3MPGT"];
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

// ─── Main ─────────────────────────────────────────────────────────────

export async function getBundlingRequirements(
	query: BundlingQuery,
): Promise<BundlingItem[]> {
	const pool = await getDb();
	const { classID, siteID, dateRanges, frequency } = query;

	const { clause: siteClause, params: siteParams, filteredIDs: siteFilter } =
		buildSiteClause(
			siteID?.filter((s) => ALLOWED_SITE_IDS.includes(s)) ?? [],
		);
	const { clause: dateClause, params: dateParams } =
		buildDateRangeClause(dateRanges);

	// ── Step 1: Aggregated sales query (promo items only) ──────────
	// Same SQL as purchasing but with EXISTS check for Component table
	// to only return promo/kit items.

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
			-- Only promo/kit items (items that HAVE Component entries)
			AND EXISTS (SELECT 1 FROM dbo.Component c WHERE c.KitID = i.InvtID)
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

	// ── Step 2: Collect distinct promo InvtIDs ─────────────────────
	const invtIDs = [...new Set(groups.map((g) => g.InvtID as string))];

	// ── Step 3: Fetch ItemSite stock levels for promo items ────────
	const siteIDsForStock = siteFilter.length > 0 ? siteFilter : ALLOWED_SITE_IDS;
	const stockMap = await fetchStockLevels(invtIDs, siteIDsForStock, pool);

	// ── Step 4: Fetch Component definitions for each promo item ─────
	const componentDefs = await fetchComponentDefinitions(invtIDs, pool);

	// ── Step 5: Collect all component InvtIDs and fetch their stock ──
	const allComponentIDs = [
		...new Set(componentDefs.map((c) => c.CmpnentID)),
	];
	const componentStockMap = allComponentIDs.length > 0
		? await fetchStockLevels(allComponentIDs, siteIDsForStock, pool)
		: new Map<string, { qtyOnHand: number; qtyAvail: number; qtyOnPO: number; qtyAlloc: number }>();

	// ── Step 6: Build INUnit conversion cache (promo + components) ──
	const allInvtForConv = [...new Set([...invtIDs, ...allComponentIDs])];
	const convCache = await buildConversionCache(allInvtForConv);

	// ── Step 7: Validate all unit conversions ──────────────────────
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

	// ── Step 8: Resolve min stock (coverage threshold) per item ──
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

	// ── Step 9: Assemble period demand per promo item ──────────────
	const periodKeys = generatePeriodKeys(dateRanges, frequency);

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

	// ── Step 10: Fetch component descriptions ──────────────────────
	const compDescrMap = allComponentIDs.length > 0
		? await fetchInventoryDescriptions(allComponentIDs, pool)
		: new Map<string, string>();

	// ── Step 11: Build response ────────────────────────────────────
	const nPeriods = periodKeys.length || 1;

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
	const results: BundlingItem[] = [];

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

		// ── Component analysis ──────────────────────────────────────
		const compDefsForThis = componentDefs.filter((c) => c.KitID === id);
		const components: ComponentStock[] = compDefsForThis.map((cd) => {
			const compStock = componentStockMap.get(cd.CmpnentID) ?? {
				qtyOnHand: 0,
				qtyAvail: 0,
				qtyOnPO: 0,
				qtyAlloc: 0,
			};
			// Convert component qty per bundle if units differ
			const qtyPerBundle = cd.CmpnentQty;
			const maxBundles =
				qtyPerBundle > 0
					? Math.floor(compStock.qtyAvail / qtyPerBundle)
					: 0;

			return {
				cmpnentID: cd.CmpnentID,
				descr: compDescrMap.get(cd.CmpnentID) ?? "",
				stkUnit: cd.CmpnentStkUnit ?? "",
				qtyPerBundle,
				qtyOnHand: Math.round(compStock.qtyOnHand * 100) / 100,
				qtyAvail: Math.round(compStock.qtyAvail * 100) / 100,
				qtyOnPO: Math.round(compStock.qtyOnPO * 100) / 100,
				qtyAlloc: Math.round(compStock.qtyAlloc * 100) / 100,
				maxBundlesFromStock: maxBundles,
			};
		});

		// Limited by the component with the fewest complete bundles
		const bundlableQuantity =
			components.length > 0
				? Math.min(...components.map((c) => c.maxBundlesFromStock))
				: 0;

		// Suggested bundles: produce up to demand, limited by component availability
		const suggestedBundles = bundlableQuantity > 0
			? Math.max(0, Math.min(Math.ceil(avgDemand), bundlableQuantity))
			: 0;

		// Can fulfill from bundling only if there is actual component stock AND it covers demand
		const canFulfillFromBundling =
			bundlableQuantity > 0 && bundlableQuantity >= Math.ceil(avgDemand);

		// Coverage threshold and suggested order (same logic as purchasing)
		const coverageThreshold = coverageMap.get(id) ?? 1;
		const effectiveThreshold = coverageThreshold * monthToWeekFactor;
		const targetStock = effectiveThreshold * avgDemand;
		const suggestedOrder = Math.max(
			0,
			Math.round((targetStock - stock.qtyAvail - stock.qtyOnPO) * 100) / 100,
		);

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
			coverageThreshold,
			suggestedOrder,
			components,
			bundlableQuantity,
			suggestedBundles,
			canFulfillFromBundling,
		});
	}

	return results;
}

// ─── Helper: fetch stock levels for a set of InvtIDs ──────────────────

async function fetchStockLevels(
	invtIDs: string[],
	siteIDs: string[],
	pool: Awaited<ReturnType<typeof getDb>>,
): Promise<
	Map<string, { qtyOnHand: number; qtyAvail: number; qtyOnPO: number; qtyAlloc: number }>
> {
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

	const map = new Map<
		string,
		{ qtyOnHand: number; qtyAvail: number; qtyOnPO: number; qtyAlloc: number }
	>();
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

// ─── Helper: fetch component definitions for promo kit items ─────────

interface ComponentDef {
	KitID: string;
	CmpnentID: string;
	CmpnentQty: number;
	CmpnentStkUnit: string;
}

async function fetchComponentDefinitions(
	kitIDs: string[],
	pool: Awaited<ReturnType<typeof getDb>>,
): Promise<ComponentDef[]> {
	if (kitIDs.length === 0) return [];

	const kitPH = kitIDs.map((_, i) => `@kit${i}`);
	const sql = `
		SELECT c.KitID, c.CmpnentID, c.CmpnentQty, i.StkUnit AS CmpnentStkUnit
		FROM dbo.Component c
		LEFT JOIN dbo.Inventory i ON c.CmpnentID = i.InvtID
		WHERE c.KitID IN (${kitPH.join(", ")})
	`;
	const req = pool.request();
	for (const [i, kid] of kitIDs.entries()) req.input(`kit${i}`, kid);

	const result = await req.query(sql);
	return trimStrings(result.recordset) as ComponentDef[];
}

// ─── Helper: fetch inventory descriptions for a set of InvtIDs ────────

async function fetchInventoryDescriptions(
	invtIDs: string[],
	pool: Awaited<ReturnType<typeof getDb>>,
): Promise<Map<string, string>> {
	if (invtIDs.length === 0) return new Map();

	const invtPH = invtIDs.map((_, i) => `@invt${i}`);
	const sql = `
		SELECT InvtID, Descr
		FROM dbo.Inventory
		WHERE InvtID IN (${invtPH.join(", ")})
	`;
	const req = pool.request();
	for (const [i, id] of invtIDs.entries()) req.input(`invt${i}`, id);

	const result = await req.query(sql);
	const rows = trimStrings(result.recordset) as { InvtID: string; Descr: string }[];
	const map = new Map<string, string>();
	for (const r of rows) {
		map.set(r.InvtID, r.Descr ?? "");
	}
	return map;
}
