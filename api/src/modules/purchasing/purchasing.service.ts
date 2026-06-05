import { withTenantDb } from "../../config/with-tenant-db";
import { trimStrings } from "../../utils/trimStrings";
import { BadRequestError } from "../../middlewares/error";
import {
	buildConversionCache,
	normaliseQtyCached,
	getConversionFactor,
} from "../../utils/unitConversion";
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
	computeMonthToWeekFactor,
	round2,
} from "../../shared/sales-service";
import type { RequirementsQuery, RequirementItem } from "./purchasing.schema";

// ─── Main ─────────────────────────────────────────────────────────────

export async function getRequirements(
	query: RequirementsQuery,
	tenantKey = "default",
): Promise<RequirementItem[]> {
	const { classID, siteID, dateRange, frequency, validDays, demandSource, priceClass, demandMode } = query;
	const activePriceClass = priceClass ?? "CP1";

	return withTenantDb(tenantKey, async (pool) => {

	// ── Step 1: Aggregated sales query (exclude promo/kit items) ──
	const { groups, siteFilter } = await executeSalesQuery(
		{
			classID,
			siteID,
			dateRange,
			frequency,
			demandSource,
			itemFilterSQL:
				"AND NOT EXISTS (SELECT 1 FROM dbo.Component c WHERE c.KitID = i.InvtID)",
		},
		pool,
	);

	if (groups.length === 0) return [];

	// ── Step 2: Collect distinct InvtIDs ──────────────────────────
	const invtIDs = [...new Set(groups.map((g) => g.InvtID as string))];

	// ── Step 3: Fetch ItemSite stock levels ───────────────────────
	const siteIDsForStock = siteFilter.length > 0 ? siteFilter : ALLOWED_SITE_IDS;
	const stockMap = await fetchStockLevels(invtIDs, siteIDsForStock, pool);

	// ── Step 4: Bulk INUnit conversion cache ──────────────────────
	const convCache = await buildConversionCache(invtIDs, tenantKey);

	// ── Step 5: Resolve min stock (coverage threshold) per item ──
	const coverageMap = await resolveCoverageThresholds(groups, invtIDs, tenantKey);

	// ── Step 6: Validate all unit conversions ─────────────────────
	validateConversions(groups, convCache);

	// ── Step 7: Assemble period demand per item ───────────────────
	const periodKeys = generatePeriodKeys([dateRange], frequency);
	const demandMap = buildDemandMap(groups, periodKeys, frequency, convCache);

	// ── Step 8: Build response ────────────────────────────────────
	const nPeriods = periodKeys.length || 1;

	// Weekly mode requires validDays (sum of per-month working days).
	// Frontend always sends monthlyValidDays (→ validDays) from user inputs.
	// Without working days, the month-to-week conversion and avgDemand cannot
	// be computed correctly for a 6-day working week.
	if (frequency === "weekly" && (!validDays || validDays <= 0)) {
		throw new BadRequestError(
			"validDays is required when frequency is weekly. " +
				"Set working days per month in the weekly settings.",
		);
	}

	const monthToWeekFactor = computeMonthToWeekFactor(
		frequency, periodKeys, validDays,
	);

	const results: RequirementItem[] = [];

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
			demandMode,
			entry.periodDemand,
		);

		const stockCoverCount = computeStockCoverCount(avgDemand, stock.qtyAvail);

		const periodDemandObj: Record<string, number> = {};
		for (const [k, v] of entry.periodDemand) {
			periodDemandObj[k] = round2(v);
		}

		const coverageThreshold = coverageMap.get(id) ?? 1;
		const effectiveThreshold = coverageThreshold * monthToWeekFactor;
		// Stock-aware: how much to bring stock up to (threshold × projected need)
		const targetStock = effectiveThreshold * avgDemand;
		const suggestedOrder = Math.max(
			0,
			round2(targetStock - stock.qtyAvail - stock.qtyOnPO),
		);

		// Convert to CS (cases) using INUnit cache
		const TARGET_CS = "CS";
		// Qty/CS = stock units per 1 CS (e.g. 24 PCS per CS).
		// INUnit stores CS→PCS = 24, so we ask "CS → StkUnit" to get the factor directly.
		const qtyPerCS = getConversionFactor(convCache, id, TARGET_CS, entry.stkUnit);
		const avgDemandCS = round2(
			normaliseQtyCached(convCache, id, avgDemand, entry.stkUnit, TARGET_CS),
		);
		const totalDemandCS = round2(
			normaliseQtyCached(convCache, id, entry.totalNormalised, entry.stkUnit, TARGET_CS),
		);
		const suggestedOrderCS = round2(
			normaliseQtyCached(convCache, id, suggestedOrder, entry.stkUnit, TARGET_CS),
		);

		results.push({
			invtID: id,
			descr: entry.descr,
			stkUnit: entry.stkUnit,
			classID: entry.classID,
			qtyPerCS,
			qtyOnHand: round2(stock.qtyOnHand),
			qtyAvail: round2(stock.qtyAvail),
			qtyOnPO: round2(stock.qtyOnPO),
			qtyAlloc: round2(stock.qtyAlloc),
			periodDemand: periodDemandObj,
			avgDemand,
			avgDemandCS,
			totalDemandCS,
			stockCoverCount,
			coverageThreshold,
			suggestedOrder,
			suggestedOrderCS,
			customOrder: null,
			amount: null,
		});
	}

	// ── Step 9: Enrich with price data for the selected priceClass ──
	if (results.length > 0) {
		const priceInvtIDs = results.map((r) => r.invtID);
		const pricePH = priceInvtIDs.map((_, i) => `@pInvtID${i}`);

		const priceSql = `
			SELECT inventory_id, price, unit, price_class, valid_from
			FROM SMR_ItemPrice
			WHERE inventory_id IN (${pricePH.join(", ")})
				AND valid_to IS NULL
				AND price_class = @priceClass
		`;

		const priceReq = pool.request();
		for (const [i, id] of priceInvtIDs.entries()) {
			priceReq.input(`pInvtID${i}`, id);
		}
		priceReq.input("priceClass", activePriceClass);

		const priceResult = await priceReq.query(priceSql);
		const priceRows = trimStrings(priceResult.recordset ?? []) as Record<
			string,
			any
		>[];

		// Map by inventory_id → { price, unit, valid_from }
		const priceMap = new Map<
			string,
			{ price: number; unit: string; valid_from: string }
		>();
		for (const row of priceRows) {
			const invtID = row.inventory_id as string;
			const priceVal = Number(row.price) || 0;
			const unit = (row.unit as string) ?? "";
			const rawDate = row.valid_from;
			const validFrom =
				rawDate instanceof Date ? rawDate.toISOString() : String(rawDate ?? "");
			priceMap.set(invtID, { price: priceVal, unit, valid_from: validFrom });
		}

		for (const item of results) {
			const priceEntry = priceMap.get(item.invtID);
			if (!priceEntry) continue;

			item.price_ao = priceEntry.valid_from;
			item.price_perCS =
				round2(
					normaliseQtyCached(
						convCache,
						item.invtID,
						priceEntry.price,
						"CS",
						priceEntry.unit,
					),
				);
			if (
				priceEntry.unit.toUpperCase() === item.stkUnit.toUpperCase()
			) {
				item.price_perStkUnit = priceEntry.price;
			} else {
				item.price_perStkUnit =
					round2(
						normaliseQtyCached(
							convCache,
							item.invtID,
							priceEntry.price,
							item.stkUnit,
							priceEntry.unit,
						),
					);
			}
		}

		// ── Compute Amount ────────────────────────────────────
		for (const item of results) {
			const orderQty = item.customOrder ?? item.suggestedOrderCS;
			const priceCS = item.price_perCS;
			item.amount =
				priceCS != null
					? round2(orderQty * priceCS)
					: null;
		}
	}

	return results;
	});
}
