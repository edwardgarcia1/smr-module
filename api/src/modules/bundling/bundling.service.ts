import { withTenantDb } from "../../config/with-tenant-db";
import type sql from "mssql";
import { trimStrings } from "../../utils/trimStrings";
import {
	runSalesPipeline,
	extendConvCache,
	fetchStockLevels,
	computeAvgDemand,
	computeStockCoverCount,
	computeCoverageAndOrder,
	EMPTY_STOCK,
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

	// ── Step 1: Run shared pipeline (sales query, stock, coverage, demand) ─
	const pipeline = await runSalesPipeline(
		{
			classID,
			siteID,
			dateRange,
			frequency,
			demandSource,
			validDays,
			itemFilterSQL:
				"AND EXISTS (SELECT 1 FROM dbo.Component c WHERE c.KitID = i.InvtID)",
		},
		pool,
		tenantKey,
	);

	if (pipeline.groups.length === 0) return [];

	// ── Step 2: Fetch Component definitions for each promo item ─────
	const componentDefs = await fetchComponentDefinitions(pipeline.invtIDs, pool);

	// ── Step 3: Collect all component InvtIDs ───────────────────────
	const allComponentIDs = [
		...new Set(componentDefs.map((c) => c.CmpnentID)),
	];

	// ── Step 4: Extend conversion cache with component IDs ─────────
	await extendConvCache(pipeline.convCache, allComponentIDs, tenantKey);

	// ── Step 5: Fetch component stock levels ───────────────────────
	const componentStockMap = allComponentIDs.length > 0
		? await fetchStockLevels(allComponentIDs, pipeline.siteIDsForStock, pool)
		: new Map<string, { qtyOnHand: number; qtyAvail: number; qtyOnPO: number; qtyAlloc: number }>();

	// ── Step 6: Fetch component descriptions ───────────────────────
	const compDescrMap = allComponentIDs.length > 0
		? await fetchInventoryDescriptions(allComponentIDs, pool)
		: new Map<string, string>();

	// ── Step 7: Build response ────────────────────────────────────
	const nPeriods = pipeline.nPeriods;
	const results: BundlingItem[] = [];

	for (const [id, entry] of pipeline.demandMap) {
		const stock = pipeline.stockMap.get(id) ?? EMPTY_STOCK;

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
			const compStock = componentStockMap.get(cd.CmpnentID) ?? EMPTY_STOCK;
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

		const { coverageThreshold, suggestedOrder } = computeCoverageAndOrder(
			id,
			pipeline.coverageMap,
			pipeline.monthToWeekFactor,
			avgDemand,
			stock,
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
