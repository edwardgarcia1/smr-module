import { getDb } from "../../config/db";
import { trimStrings } from "../../utils/trimStrings";
import { NotFoundError, BadRequestError } from "../../middlewares/error";
import {
	getProductClassesWithVendors,
} from "../principal/principal.service";
import { getAllInventory } from "../item/item.service";
import type {
	MinStockSetting,
	NewMinStockSetting,
	MinStockSettingUpdate,
	MinStockItem,
	NewMinStockItem,
	MinStockItemUpdate,
	MinStockPrincipal,
	NewMinStockPrincipal,
	MinStockPrincipalUpdate,
	MinStockSettingValue,
	ResolvedMinStock,
	PrincipalWithMinStockDetails,
	ItemWithMinStockDetails,
	MinStockCategory,
} from "./min-stock.schema";

// ─── MinStockSetting CRUD ────────────────────────────────────────────

export async function getAllSettings(): Promise<MinStockSetting[]> {
	const pool = await getDb();
	const result = await pool
		.request()
		.query("SELECT id, inventory_id, class_id, min_stock_setting FROM SMR_MinStockSetting ORDER BY inventory_id");
	return trimStrings(result.recordset as MinStockSetting[]);
}

export async function getSettingByInvtId(
	invtId: string,
): Promise<MinStockSetting | undefined> {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("inventory_id", invtId)
		.query(
			"SELECT id, inventory_id, class_id, min_stock_setting FROM SMR_MinStockSetting WHERE inventory_id = @inventory_id",
		);
	return trimStrings(result.recordset[0] as MinStockSetting | undefined);
}

export async function upsertSetting(
	body: NewMinStockSetting,
): Promise<MinStockSetting> {
	const valid = ["Custom", "Principal", "Default"];
	if (!valid.includes(body.min_stock_setting)) {
		throw new BadRequestError(
			`min_stock_setting must be one of: ${valid.join(", ")}`,
		);
	}

	const pool = await getDb();
	const result = await pool
		.request()
		.input("inventory_id", body.inventory_id)
		.input("class_id", body.class_id)
		.input("min_stock_setting", body.min_stock_setting).query(`
      MERGE SMR_MinStockSetting AS target
      USING (SELECT @inventory_id AS inventory_id) AS source
      ON target.inventory_id = source.inventory_id
      WHEN MATCHED THEN
        UPDATE SET class_id = @class_id, min_stock_setting = @min_stock_setting
      WHEN NOT MATCHED THEN
        INSERT (inventory_id, class_id, min_stock_setting)
        VALUES (@inventory_id, @class_id, @min_stock_setting)
      OUTPUT INSERTED.id, INSERTED.inventory_id, INSERTED.class_id, INSERTED.min_stock_setting;
    `);

	const row = result.recordset[0];
	if (!row) throw new Error("Failed to upsert MinStockSetting");
	return trimStrings(row as MinStockSetting);
}

export async function updateSetting(
	invtId: string,
	updates: MinStockSettingUpdate,
): Promise<MinStockSetting> {
	const valid = ["Custom", "Principal", "Default"];
	if (!valid.includes(updates.min_stock_setting)) {
		throw new BadRequestError(
			`min_stock_setting must be one of: ${valid.join(", ")}`,
		);
	}

	const pool = await getDb();
	const result = await pool
		.request()
		.input("inventory_id", invtId)
		.input("min_stock_setting", updates.min_stock_setting).query(`
      UPDATE SMR_MinStockSetting
      SET min_stock_setting = @min_stock_setting
      OUTPUT INSERTED.id, INSERTED.inventory_id, INSERTED.class_id, INSERTED.min_stock_setting
      WHERE inventory_id = @inventory_id
    `);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`MinStockSetting for ${invtId} not found`);
	}
	return trimStrings(result.recordset[0] as MinStockSetting);
}

export async function deleteSetting(invtId: string): Promise<void> {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("inventory_id", invtId)
		.query(
			"DELETE FROM SMR_MinStockSetting OUTPUT DELETED.id WHERE inventory_id = @inventory_id",
		);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`MinStockSetting for ${invtId} not found`);
	}
}

// ─── MinStockItem CRUD ───────────────────────────────────────────────

export async function getAllMinStockItems(): Promise<MinStockItem[]> {
	const pool = await getDb();
	const result = await pool
		.request()
		.query("SELECT id, inventory_id, min_stock FROM SMR_MinStockItem ORDER BY inventory_id");
	return trimStrings(result.recordset as MinStockItem[]);
}

export async function getMinStockItemById(
	id: number,
): Promise<MinStockItem | undefined> {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("id", id)
		.query(
			"SELECT id, inventory_id, min_stock FROM SMR_MinStockItem WHERE id = @id",
		);
	return trimStrings(result.recordset[0] as MinStockItem | undefined);
}

export async function getMinStockItemByInvtId(
	invtId: string,
): Promise<MinStockItem | undefined> {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("inventory_id", invtId)
		.query(
			"SELECT id, inventory_id, min_stock FROM SMR_MinStockItem WHERE inventory_id = @inventory_id",
		);
	return trimStrings(result.recordset[0] as MinStockItem | undefined);
}

export async function createMinStockItem(
	body: NewMinStockItem,
): Promise<MinStockItem> {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("inventory_id", body.inventory_id)
		.input("min_stock", body.min_stock).query(`
      INSERT INTO SMR_MinStockItem (inventory_id, min_stock)
      OUTPUT INSERTED.id, INSERTED.inventory_id, INSERTED.min_stock
      VALUES (@inventory_id, @min_stock)
    `);
	const row = result.recordset[0];
	if (!row) throw new Error("Failed to create MinStockItem");
	return row as MinStockItem;
}

export async function updateMinStockItem(
	id: number,
	updates: MinStockItemUpdate,
): Promise<MinStockItem> {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("id", id)
		.input("min_stock", updates.min_stock).query(`
      UPDATE SMR_MinStockItem
      SET min_stock = @min_stock
      OUTPUT INSERTED.id, INSERTED.inventory_id, INSERTED.min_stock
      WHERE id = @id
    `);
	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`MinStockItem ${id} not found`);
	}
	return result.recordset[0] as MinStockItem;
}

export async function deleteMinStockItem(id: number): Promise<void> {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("id", id)
		.query("DELETE FROM SMR_MinStockItem OUTPUT DELETED.id WHERE id = @id");
	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`MinStockItem ${id} not found`);
	}
}

// ─── MinStockPrincipal CRUD ──────────────────────────────────────────

export async function getAllMinStockPrincipals(): Promise<
	MinStockPrincipal[]
> {
	const pool = await getDb();
	const result = await pool
		.request()
		.query("SELECT id, class_id, min_stock FROM SMR_MinStockPrincipal ORDER BY class_id");
	return trimStrings(result.recordset as MinStockPrincipal[]);
}

export async function getMinStockPrincipalById(
	id: number,
): Promise<MinStockPrincipal | undefined> {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("id", id)
		.query(
			"SELECT id, class_id, min_stock FROM SMR_MinStockPrincipal WHERE id = @id",
		);
	return trimStrings(result.recordset[0] as MinStockPrincipal | undefined);
}

export async function getMinStockPrincipalByClassId(
	classId: string,
): Promise<MinStockPrincipal | undefined> {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("class_id", classId)
		.query(
			"SELECT id, class_id, min_stock FROM SMR_MinStockPrincipal WHERE class_id = @class_id",
		);
	return trimStrings(result.recordset[0] as MinStockPrincipal | undefined);
}

export async function createMinStockPrincipal(
	body: NewMinStockPrincipal,
): Promise<MinStockPrincipal> {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("class_id", body.class_id)
		.input("min_stock", body.min_stock).query(`
      INSERT INTO SMR_MinStockPrincipal (class_id, min_stock)
      OUTPUT INSERTED.id, INSERTED.class_id, INSERTED.min_stock
      VALUES (@class_id, @min_stock)
    `);
	const row = result.recordset[0];
	if (!row) throw new Error("Failed to create MinStockPrincipal");
	return row as MinStockPrincipal;
}

export async function updateMinStockPrincipal(
	id: number,
	updates: MinStockPrincipalUpdate,
): Promise<MinStockPrincipal> {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("id", id)
		.input("min_stock", updates.min_stock).query(`
      UPDATE SMR_MinStockPrincipal
      SET min_stock = @min_stock
      OUTPUT INSERTED.id, INSERTED.class_id, INSERTED.min_stock
      WHERE id = @id
    `);
	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`MinStockPrincipal ${id} not found`);
	}
	return result.recordset[0] as MinStockPrincipal;
}

/**
 * After a principal's min stock is set, propagate the 'Principal' setting
 * to all items in the same class that currently have 'Default' (or no setting).
 * Items with 'Custom' are left untouched.
 */
export async function propagatePrincipalToItems(
	classId: string,
): Promise<void> {
	const pool = await getDb();

	// Update existing settings from Default → Principal
	await pool
		.request()
		.input("class_id", classId)
		.query(`
      UPDATE SMR_MinStockSetting
      SET min_stock_setting = 'Principal'
      WHERE class_id = @class_id
        AND min_stock_setting = 'Default'
    `);

	// Create settings for items in this class that have no explicit setting yet
	await pool
		.request()
		.input("class_id", classId)
		.query(`
      INSERT INTO SMR_MinStockSetting (inventory_id, class_id, min_stock_setting)
      SELECT i.InvtID, i.ClassID, 'Principal'
      FROM Inventory i
      LEFT JOIN SMR_MinStockSetting s ON i.InvtID = s.inventory_id
      WHERE i.ClassID = @class_id
        AND s.id IS NULL
    `);
}

export async function deleteMinStockPrincipal(id: number): Promise<void> {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("id", id)
		.query(
			"DELETE FROM SMR_MinStockPrincipal OUTPUT DELETED.id WHERE id = @id",
		);
	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`MinStockPrincipal ${id} not found`);
	}
}

// ─── Merged queries (principal/item data + min stock) ───────────────

/**
 * Returns all product classes with their vendor info and per-class min stock values.
 * Single endpoint — no extra frontend join needed.
 */
export async function getAllPrincipalsWithMinStock(): Promise<
	PrincipalWithMinStockDetails[]
> {
	const [principals, minStockPrincipals] = await Promise.all([
		getProductClassesWithVendors(),
		getAllMinStockPrincipals(),
	]);

	const mpMap = new Map<string, MinStockPrincipal>();
	for (const mp of minStockPrincipals) {
		mpMap.set(mp.class_id, mp);
	}

	return principals
		.map((p) => {
			const mp = mpMap.get(p.ClassID);
			return {
				ClassID: p.ClassID,
				Descr: p.Descr,
				User5: p.User5,
				VendId: p.VendId,
				VendorAddr1: p.VendorAddr1,
				VendorAddr2: p.VendorAddr2,
				VendorCity: p.VendorCity,
				VendorTerms: p.VendorTerms,
				minStock: mp ? mp.min_stock : 0,
				minStockId: mp ? mp.id : null,
			};
		});
}

/**
 * Returns all inventory items with their resolved min stock value and setting.
 * Resolution mirrors resolveMinStock() logic:
 *   Custom    → item-level SMR_MinStockItem value
 *   Principal → class-level SMR_MinStockPrincipal value
 *   Default   → global default row (inventory_id = 'Default')
 */
export async function getAllItemsWithMinStock(): Promise<
	ItemWithMinStockDetails[]
> {
	const [items, settings, minStockItems, principals] = await Promise.all([
		getAllInventory(),
		getAllSettings(),
		getAllMinStockItems(),
		getAllMinStockPrincipals(),
	]);

	const settingMap = new Map<string, MinStockSetting>();
	for (const s of settings) {
		settingMap.set(s.inventory_id, s);
	}

	const itemMinStockMap = new Map<string, MinStockItem>();
	for (const mi of minStockItems) {
		itemMinStockMap.set(mi.inventory_id, mi);
	}

	const principalMap = new Map<string, MinStockPrincipal>();
	for (const p of principals) {
		principalMap.set(p.class_id, p);
	}

	// Global fallback: the seeded 'Default' row (should be 1.0)
	const defaultItem = minStockItems.find(
		(mi) => mi.inventory_id === "Default",
	);
	const defaultMinStock = defaultItem ? defaultItem.min_stock : 1.0;

	return items.map((inv) => {
		const s = settingMap.get(inv.InvtID);
		const setting = s?.min_stock_setting ?? "Default";

		let minStock: number;
		switch (setting) {
			case "Custom": {
				const mi = itemMinStockMap.get(inv.InvtID);
				minStock = mi ? mi.min_stock : 0;
				break;
			}
			case "Principal": {
				const p = principalMap.get(inv.ClassID);
				minStock =
					p && p.min_stock !== 0 ? p.min_stock : defaultMinStock;
				break;
			}
			case "Default":
			default: {
				minStock = defaultMinStock;
				break;
			}
		}

		return {
			InvtID: inv.InvtID,
			ClassID: inv.ClassID,
			Descr: inv.Descr,
			setting,
			minStock,
			minStockSettingId: s?.id ?? null,
			minStockItemId: itemMinStockMap.get(inv.InvtID)?.id ?? null,
		};
	});
}

// ─── Resolve effective min stock ─────────────────────────────────────
// Logic:
//   1. Look up SMR_MinStockSetting by inventory_id
//   2. If not found → fallback to Default
//   3. If Custom  → read SMR_MinStockItem by inventory_id
//   4. If Principal → read SMR_MinStockPrincipal by class_id
//   5. If Default  → read SMR_MinStockItem WHERE inventory_id = 'Default'

export async function resolveMinStock(
	invtID: string,
	classID: string,
): Promise<ResolvedMinStock> {
	const pool = await getDb();

	// Step 1: fetch setting (or default)
	const settingResult = await pool
		.request()
		.input("inventory_id", invtID)
		.query(
			"SELECT min_stock_setting FROM SMR_MinStockSetting WHERE inventory_id = @inventory_id",
		);

	const setting: MinStockSettingValue =
		(trimStrings(settingResult.recordset[0] as { min_stock_setting: string } | undefined)
			?.min_stock_setting as MinStockSettingValue) ?? "Default";

	switch (setting) {
		case "Custom": {
			const itemResult = await pool
				.request()
				.input("inventory_id", invtID)
				.query(
					"SELECT min_stock FROM SMR_MinStockItem WHERE inventory_id = @inventory_id",
				);
			const row = trimStrings(
				itemResult.recordset[0] as { min_stock: number } | undefined,
			);
			return {
				invtID,
				classID,
				minStock: row ? Number(row.min_stock) : 0,
				source: "custom",
				setting,
			};
		}
		case "Principal": {
			const principalResult = await pool
				.request()
				.input("class_id", classID)
				.query(
					"SELECT min_stock FROM SMR_MinStockPrincipal WHERE class_id = @class_id",
				);
			const row = trimStrings(
				principalResult.recordset[0] as { min_stock: number } | undefined,
			);
			if (row && Number(row.min_stock) !== 0) {
				return {
					invtID,
					classID,
					minStock: Number(row.min_stock),
					source: "principal",
					setting,
				};
			}
			// Principal value is 0/missing → fall through to Default
			const defaultResult = await pool
				.request()
				.query(
					"SELECT min_stock FROM SMR_MinStockItem WHERE inventory_id = 'Default'",
				);
			const defaultRow = trimStrings(
				defaultResult.recordset[0] as { min_stock: number } | undefined,
			);
			return {
				invtID,
				classID,
				minStock: defaultRow ? Number(defaultRow.min_stock) : 1.0,
				source: "default",
				setting,
			};
		}
		case "Default":
		default: {
			const defaultResult = await pool
				.request()
				.query(
					"SELECT min_stock FROM SMR_MinStockItem WHERE inventory_id = 'Default'",
				);
			const row = trimStrings(
				defaultResult.recordset[0] as { min_stock: number } | undefined,
			);
			return {
				invtID,
				classID,
				minStock: row ? Number(row.min_stock) : 1.0,
				source: "default",
				setting,
			};
		}
	}
}

/** Bulk resolve for multiple items at once. */
export async function resolveManyMinStock(
	items: { invtID: string; classID: string }[],
): Promise<ResolvedMinStock[]> {
	return Promise.all(items.map((i) => resolveMinStock(i.invtID, i.classID)));
}

// ─── MinStockCategory ────────────────────────────────────────────────

/**
 * Get all min stock categories ordered by threshold ASC.
 * Used by frontend to categorise items based on stock cover / min stock ratio.
 */
export async function getAllCategories(): Promise<MinStockCategory[]> {
	const pool = await getDb();
	const result = await pool
		.request()
		.query(
			"SELECT id, category_name, threshold FROM SMR_MinStockCategory ORDER BY threshold ASC",
		);
	return result.recordset as MinStockCategory[];
}
