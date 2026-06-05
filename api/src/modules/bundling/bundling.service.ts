import { withTenantDb } from "../../config/with-tenant-db";
import type sql from "mssql";
import { trimStrings } from "../../utils/trimStrings";
import { buildConversionCache } from "../../utils/unitConversion";
import { generatePeriodKeys } from "../../utils/periodHelpers";
import {
	ALLOWED_SITE_IDS,
	executeSalesQuery,
	fetchStockLevels,
	validateConversions,
	resolveCoverageThresholds,
	buildDemandMap,
	computeAvgDemand,
	computeStockCoverCount,
	round2,
} from "../../shared/sales-service";
import type {
	BundlingItem,
	BundlingQuery,
	ComponentStock,
} from "./bundling.schema";

// ─── Main ─────────────────────────────────────────────────────────────

export async function getBundlingRequirements(
	query: BundlingQuery,
	tenantKey = "default",
): Promise<BundlingItem[]> {
	const { classID, siteID, dateRange, frequency, validDays, demandSource } = query;

	return withTenantDb(tenantKey, async (pool) => {

	// ── Step 1: Aggregated sales query (promo items only) ──────────
	const { groups, siteFilter } = await executeSalesQuery(
		{
			classID,
			siteID,
			dateRange,
			frequency,
			demandSource,
			itemFilterSQL:
				"AND EXISTS (SELECT 1 FROM dbo.Component c WHERE c.KitID = i.InvtID)",
		},
		pool,
	);

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
	const convCache = await buildConversionCache(allInvtForConv, tenantKey);

	// ── Step 7: Validate all unit conversions ──────────────────────
	validateConversions(groups, convCache);

	// ── Step 8: Resolve min stock (coverage threshold) per item ──
	const coverageMap = await resolveCoverageThresholds(groups, invtIDs, tenantKey);

	// ── Step 9: Assemble period demand per promo item ──────────────
	const periodKeys = generatePeriodKeys([dateRange], frequency);
	const demandMap = buildDemandMap(groups, periodKeys, frequency, convCache);

	// ── Step 10: Fetch component descriptions ──────────────────────
	const compDescrMap = allComponentIDs.length > 0
		? await fetchInventoryDescriptions(allComponentIDs, pool)
		: new Map<string, string>();

	// ── Step 11: Build response ────────────────────────────────────
	const nPeriods = periodKeys.length || 1;

	// Determine whether to use working-week (6-day) or system-week formula.
	const useWorkingWeekFormula =
		frequency === "weekly" && validDays != null && validDays > 0;

	const monthToWeekFactor = (() => {
		if (frequency !== "weekly" || periodKeys.length === 0) return 1.0;
		const uniqueMonths = new Set(
			periodKeys.map((k) => {
				const m = k.match(/W\d+\s+(.+)/);
				return m ? m[1] : k;
			}),
		);
		const nMonths = uniqueMonths.size;
		if (nMonths === 0) return 1.0;

		if (useWorkingWeekFormula) {
			// Working weeks per month: (total working days / 6) / nMonths
			return (validDays! / 6) / nMonths;
		}
		// Fallback: system weeks per month (W1-W5 per month)
		return nPeriods / nMonths;
	})();

	const results: BundlingItem[] = [];

	for (const [id, entry] of demandMap) {
		const stock = stockMap.get(id) ?? {
			qtyOnHand: 0,
			qtyAvail: 0,
			qtyOnPO: 0,
			qtyAlloc: 0,
		};

		const avgDemand = computeAvgDemand(
			entry.totalNormalised,
			nPeriods,
			frequency,
			validDays,
		);

		const stockCoverCount = computeStockCoverCount(avgDemand, stock.qtyAvail);

		const periodDemandObj: Record<string, number> = {};
		for (const [k, v] of entry.periodDemand) {
			periodDemandObj[k] = round2(v);
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
				qtyOnHand: round2(compStock.qtyOnHand),
				qtyAvail: round2(compStock.qtyAvail),
				qtyOnPO: round2(compStock.qtyOnPO),
				qtyAlloc: round2(compStock.qtyAlloc),
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
			round2(targetStock - stock.qtyAvail - stock.qtyOnPO),
		);

		results.push({
			invtID: id,
			descr: entry.descr,
			stkUnit: entry.stkUnit,
			classID: entry.classID,
			qtyOnHand: round2(stock.qtyOnHand),
			qtyAvail: round2(stock.qtyAvail),
			qtyOnPO: round2(stock.qtyOnPO),
			qtyAlloc: round2(stock.qtyAlloc),
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
	});
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
	pool: sql.ConnectionPool,
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
	pool: sql.ConnectionPool,
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
