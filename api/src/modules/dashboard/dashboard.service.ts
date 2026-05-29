import { withDb } from "../../config/db";
import { trimStrings } from "../../utils/trimStrings";
import { withCache } from "../../utils/cache";
import type { DashboardSummary, ItemsPerPrincipal } from "./dashboard.schema";

/** Cache TTL for dashboard summary: 30 seconds (near-real-time) */
const DASHBOARD_CACHE_TTL = 30_000;
const CACHE_KEY = "dashboard:summary";

/**
 * Build a lightweight dashboard summary.
 *
 * All queries are simple COUNT / SUM aggregations that run in parallel.
 * No sales-history joins or heavy computations.
 * Result is cached for 30 seconds to reduce DB load.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
	return withCache(CACHE_KEY, DASHBOARD_CACHE_TTL, async () => {
		const [
			itemsCountResult,
			principalsCountResult,
			itemsWithoutPriceResult,
			itemSiteResult,
			usersCountResult,
			itemsPerPrincipalResult,
			settingDistributionResult,
		] = await Promise.all([
			// 1. Total inventory items
			withDb((pool) =>
				pool.request().query("SELECT COUNT(*) AS [count] FROM Inventory"),
			),

			// 2. Total product classes (principals)
			withDb((pool) =>
				pool.request().query("SELECT COUNT(*) AS [count] FROM ProductClass"),
			),

			// 3. Items without a current price (valid_to IS NULL means currently active)
			withDb((pool) =>
				pool.request().query(`
				SELECT COUNT(DISTINCT i.InvtID) AS [count]
				FROM Inventory i
				LEFT JOIN SMR_ItemPrice p
					ON i.InvtID = p.inventory_id AND p.valid_to IS NULL
				WHERE p.id IS NULL
			`),
			),

			// 4-6. ItemSite: merged into one query (zero avail, PO qty, total cost)
			withDb((pool) =>
				pool.request().query(`
				SELECT
					COUNT(CASE WHEN QtyAvail <= 0 THEN 1 END) AS zeroAvail,
					ISNULL(SUM(QtyOnPO), 0) AS totalPO,
					ISNULL(SUM(TotCost), 0) AS totalCost
				FROM ItemSite
			`),
			),

			// 7. Total registered users
			withDb((pool) =>
				pool.request().query("SELECT COUNT(*) AS [count] FROM SMR_Users"),
			),

			// 8. Items grouped by principal (ClassID), with principal description
			withDb((pool) =>
				pool.request().query(`
				SELECT
					ISNULL(i.ClassID, '') AS classID,
					ISNULL(p.Descr, '') AS description,
					COUNT(*) AS itemCount
				FROM Inventory i
				LEFT JOIN ProductClass p ON i.ClassID = p.ClassID
				GROUP BY i.ClassID, p.Descr
				ORDER BY COUNT(*) DESC
			`),
			),

			// 9. Min-stock setting distribution
			withDb((pool) =>
				pool.request().query(`
				SELECT min_stock_setting, COUNT(*) AS [count]
				FROM SMR_MinStockSetting
				GROUP BY min_stock_setting
			`),
			),
		]);

		// ── Assemble response ────────────────────────────────────────────

		const itemsPerPrincipal = trimStrings(
			itemsPerPrincipalResult.recordset,
		) as ItemsPerPrincipal[];

		const settingRows = settingDistributionResult.recordset as Array<{
			min_stock_setting: string;
			count: number;
		}>;
		const minStockSettingDistribution = { custom: 0, principal: 0, default: 0 };
		for (const row of settingRows) {
			const key = row.min_stock_setting.toLowerCase() as keyof typeof minStockSettingDistribution;
			if (key in minStockSettingDistribution) {
				minStockSettingDistribution[key] = row.count;
			}
		}

		return {
			totalInventoryItems: itemsCountResult.recordset[0].count,
			totalPrincipals: principalsCountResult.recordset[0].count,
			itemsWithoutPrice: itemsWithoutPriceResult.recordset[0].count,
			itemsZeroAvailable: itemSiteResult.recordset[0].zeroAvail,
			totalQtyOnPO: Number(itemSiteResult.recordset[0].totalPO),
			totalStockValue: Number(itemSiteResult.recordset[0].totalCost),
			totalUsers: usersCountResult.recordset[0].count,
			itemsPerPrincipal,
			minStockSettingDistribution,
		};
	});
}
