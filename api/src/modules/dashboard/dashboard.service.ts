import { withDb } from "../../config/db";
import { trimStrings } from "../../utils/trimStrings";
import type { DashboardSummary, ItemsPerPrincipal } from "./dashboard.schema";

/**
 * Build a lightweight dashboard summary.
 *
 * All queries are simple COUNT / SUM aggregations that run in parallel.
 * No sales-history joins or heavy computations.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
	const [
		itemsCountResult,
		principalsCountResult,
		itemsWithoutPriceResult,
		itemsZeroAvailResult,
		qtyOnPOResult,
		stockValueResult,
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

		// 4. ItemSite rows where available qty is zero or below
		withDb((pool) =>
			pool
				.request()
				.query("SELECT COUNT(*) AS [count] FROM ItemSite WHERE QtyAvail <= 0"),
		),

		// 5. Total quantity on purchase order
		withDb((pool) =>
			pool
				.request()
				.query("SELECT ISNULL(SUM(QtyOnPO), 0) AS [sum] FROM ItemSite"),
		),

		// 6. Total stock value (cost)
		withDb((pool) =>
			pool
				.request()
				.query("SELECT ISNULL(SUM(TotCost), 0) AS [sum] FROM ItemSite"),
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
		itemsZeroAvailable: itemsZeroAvailResult.recordset[0].count,
		totalQtyOnPO: Number(qtyOnPOResult.recordset[0].sum),
		totalStockValue: Number(stockValueResult.recordset[0].sum),
		totalUsers: usersCountResult.recordset[0].count,
		itemsPerPrincipal,
		minStockSettingDistribution,
	};
}
