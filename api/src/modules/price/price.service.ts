import { getDb } from "../../config/db";
import { BadRequestError, NotFoundError } from "../../middlewares/error";
import { trimStrings } from "../../utils/trimStrings";
import Big from "big.js";
import { toBig, bigToNumber } from "./price.schema";
import type {
	ItemPrice,
	NewItemPrice,
	ItemPriceUpdate,
	PriceClass,
	NewPriceClass,
	PriceClassUpdate,
	PriceRecord,
	PriceHistoryEntry,
	PaginatedResponse,
	BulkImportItem,
	ImportResult,
} from "./price.schema";

// ─── Helpers ─────────────────────────────────────────────────────────

/** Format a Date as MSSQL DATETIME string (YYYY-MM-DD HH:MM:SS) */
function toMsSqlDatetime(date: Date): string {
	return date.toISOString().slice(0, 19).replace("T", " ");
}

/** Return a DATETIME string 1 second before the given DATETIME string.
 *  Input is treated as UTC (matching toMsSqlDatetime output).
 *  Accepts "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD" (treated as midnight UTC). */
function oneSecondBefore(dtStr: string): string {
	const normalized = dtStr.replace(" ", "T");
	const iso = normalized.includes("T") ? normalized + "Z" : normalized + "T00:00:00Z";
	const d = new Date(iso);
	d.setSeconds(d.getSeconds() - 1);
	return toMsSqlDatetime(d);
}

/**
 * Normalize unit to "CS" if a conversion factor exists in INUnit.
 * INUnit stores: 1 FromUnit = CnvFact × ToUnit.
 * Returns { price, unit } with CS unit and converted price if possible,
 * otherwise returns the original values.
 */
async function normalizeToCsUnit(
	inventoryId: string,
	price: Big | number,
	unit: string,
): Promise<{ price: Big; unit: string }> {
	if (unit.toUpperCase() === "CS") return { price: toBig(price), unit };

	// Forward: found row where FromUnit = current unit, ToUnit = CS
	// 1 current_unit = factor × CS → price_per_CS = price_per_current / factor (Big precision)
	const factor = await findConversionFactor(inventoryId, unit, "CS");
	if (factor !== null) {
		return { price: toBig(price).div(factor), unit: "CS" };
	}

	// Reverse: found row where FromUnit = CS, ToUnit = current unit
	// 1 CS = reverseFactor × current_unit → price_per_CS = price_per_current × reverseFactor (Big precision)
	const reverseFactor = await findConversionFactor(inventoryId, "CS", unit);
	if (reverseFactor !== null) {
		return { price: toBig(price).times(reverseFactor), unit: "CS" };
	}

	// No conversion available — keep original
	return { price: toBig(price), unit };
}

// ─── Constants ─────────────────────────────────────────────────────────

const MAX_LIMIT = 10_000;
const DEFAULT_LIMIT = 500;

// ─── SMR_ItemPrice CRUD (renamed from SMR_ItemCost) ───────────────────

export const createItemPrice = async (item: NewItemPrice): Promise<ItemPrice> => {
	const pool = await getDb();
	const validFrom = item.valid_from ?? toMsSqlDatetime(new Date());

	// Normalize unit to CS if possible
	const normalized = await normalizeToCsUnit(item.inventory_id, item.price, item.unit);

	const result = await pool
		.request()
		.input("inventory_id", item.inventory_id)
		.input("price", bigToNumber(normalized.price))
		.input("unit", normalized.unit)
		.input("price_class", item.price_class)
		.input("valid_from", validFrom)
		.input("valid_to", item.valid_to ?? null)
		.query(`
      INSERT INTO SMR_ItemPrice (inventory_id, price, unit, price_class, valid_from, valid_to)
      OUTPUT INSERTED.id, INSERTED.inventory_id, INSERTED.price, INSERTED.unit, INSERTED.price_class, INSERTED.valid_from, INSERTED.valid_to
      VALUES (@inventory_id, @price, @unit, @price_class, @valid_from, @valid_to)
    `);

	const created = result.recordset[0];
	if (!created) throw new Error("Failed to create ItemPrice");
	return {
		...trimStrings(created as Record<string, unknown>),
		price: toBig((created as Record<string, unknown>).price),
	} as unknown as ItemPrice;
};

export const getItemPriceById = async (
	id: number,
): Promise<ItemPrice | undefined> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("id", id)
		.query(
			"SELECT id, inventory_id, price, unit, price_class, valid_from, valid_to FROM SMR_ItemPrice WHERE id = @id",
		);
	const raw = result.recordset[0] as Record<string, unknown> | undefined;
	if (!raw) return undefined;
	return {
		...trimStrings(raw),
		price: toBig(raw.price),
	} as unknown as ItemPrice;
};

export const getItemPricesByInventoryId = async (
	inventoryId: string,
): Promise<ItemPrice[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("inventory_id", inventoryId)
		.query(`
      SELECT id, inventory_id, price, unit, price_class, valid_from, valid_to
      FROM SMR_ItemPrice
      WHERE inventory_id = @inventory_id
      ORDER BY valid_from DESC
    `);
	const raw = result.recordset as Record<string, unknown>[];
	return raw.map((r) => ({
		...trimStrings(r),
		price: toBig(r.price),
	})) as unknown as ItemPrice[];
};

export const updateItemPrice = async (
	id: number,
	updates: ItemPriceUpdate,
): Promise<ItemPrice> => {
	const pool = await getDb();
	const setClauses: string[] = [];
	if (updates.price !== undefined) setClauses.push("price = @price");
	if (updates.unit !== undefined) setClauses.push("unit = @unit");
	if (updates.price_class !== undefined) setClauses.push("price_class = @price_class");
	if (updates.valid_to !== undefined) setClauses.push("valid_to = @valid_to");

	if (setClauses.length === 0) {
		const existing = await getItemPriceById(id);
		if (!existing) throw new NotFoundError(`ItemPrice ${id} not found`);
		return existing;
	}

	const req = pool.request().input("id", id);
	if (updates.price !== undefined) req.input("price", bigToNumber(toBig(updates.price)));
	if (updates.unit !== undefined) req.input("unit", updates.unit);
	if (updates.price_class !== undefined) req.input("price_class", updates.price_class);
	if (updates.valid_to !== undefined) req.input("valid_to", updates.valid_to);

	const result = await req.query(`
      UPDATE SMR_ItemPrice
      SET ${setClauses.join(", ")}
      OUTPUT INSERTED.id, INSERTED.inventory_id, INSERTED.price, INSERTED.unit, INSERTED.price_class, INSERTED.valid_from, INSERTED.valid_to
      WHERE id = @id
    `);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`ItemPrice ${id} not found`);
	}
	const raw = result.recordset[0] as Record<string, unknown>;
	return {
		...trimStrings(raw),
		price: toBig(raw.price),
	} as unknown as ItemPrice;
};

export const deleteItemPrice = async (id: number): Promise<void> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("id", id)
		.query("DELETE FROM SMR_ItemPrice OUTPUT DELETED.id WHERE id = @id");

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`ItemPrice ${id} not found`);
	}
};

/**
 * Set valid_to on an existing ItemPrice (used when replacing with a newer entry).
 * This expires the old price record 1 second before the new price's valid_from.
 */
export const expireItemPrice = async (id: number, validTo: string): Promise<void> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("id", id)
		.input("valid_to", validTo)
		.query("UPDATE SMR_ItemPrice SET valid_to = @valid_to WHERE id = @id");

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`ItemPrice ${id} not found`);
	}
};

// ─── SMR_PriceClass CRUD (simplified lookup) ──────────────────────────

export const createPriceClass = async (
	pc: NewPriceClass,
): Promise<PriceClass> => {
	const pool = await getDb();

	// Check for duplicate
	const existing = await pool
		.request()
		.input("id", pc.id)
		.query(`
      SELECT COUNT(*) AS _cnt
      FROM SMR_PriceClass
      WHERE id = @id
    `);
	if (Number(existing.recordset[0]?._cnt) > 0) {
		throw new BadRequestError(`Price class '${pc.id}' already exists.`);
	}

	const result = await pool
		.request()
		.input("id", pc.id)
		.input("description", pc.description ?? null)
		.query(`
      INSERT INTO SMR_PriceClass (id, description)
      OUTPUT INSERTED.id, INSERTED.description
      VALUES (@id, @description)
    `);

	const created = result.recordset[0];
	if (!created) throw new Error("Failed to create PriceClass");
	return trimStrings(created as Record<string, unknown>) as unknown as PriceClass;
};

/** Returns all price classes ordered by id */
export const getAllPriceClasses = async (): Promise<PriceClass[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.query(`
      SELECT id, description
      FROM SMR_PriceClass
      ORDER BY id
    `);
	return trimStrings(result.recordset as Record<string, unknown>[]) as unknown as PriceClass[];
};

/** Legacy alias — returns all price classes */
export const getPriceClasses = getAllPriceClasses;

/** Legacy alias — returns all price classes (no distinction between current/history anymore) */
export const getCurrentPriceClasses = getAllPriceClasses;

/** Returns the price class for a specific id */
export const getPriceClassById = async (
	id: string,
): Promise<PriceClass | undefined> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("id", id)
		.query(`
      SELECT id, description
      FROM SMR_PriceClass
      WHERE id = @id
    `);
	const raw = result.recordset[0] as Record<string, unknown> | undefined;
	if (!raw) return undefined;
	return trimStrings(raw) as unknown as PriceClass;
};

/** Returns just the list of price class IDs */
export const getDistinctPriceClasses = async (): Promise<string[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.query(`
      SELECT id
      FROM SMR_PriceClass
      ORDER BY id
    `);
	const rows = result.recordset as Array<{ id: string }>;
	return trimStrings(rows.map((r) => r.id));
};

export const updatePriceClass = async (
	id: string,
	updates: PriceClassUpdate,
): Promise<PriceClass> => {
	const pool = await getDb();

	const result = await pool
		.request()
		.input("id", id)
		.input("description", updates.description ?? null)
		.query(`
      UPDATE SMR_PriceClass
      SET description = @description
      OUTPUT INSERTED.id, INSERTED.description
      WHERE id = @id
    `);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`PriceClass '${id}' not found`);
	}
	return trimStrings(result.recordset[0] as Record<string, unknown>) as unknown as PriceClass;
};

export const deletePriceClass = async (id: string): Promise<void> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("id", id)
		.query(`
      DELETE FROM SMR_PriceClass
      OUTPUT DELETED.id
      WHERE id = @id
    `);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`PriceClass '${id}' not found`);
	}
};

// ─── Unit conversion helper ───────────────────────────────────────────

interface UnitConvRow {
	CnvFact: number;
	FromUnit: string;
	ToUnit: string;
}

/**
 * Find conversion factor from one unit to another for a given inventory item.
 * Searches INUnit by InvtId. Returns the factor or null if no conversion found.
 */
async function findConversionFactor(
	inventoryId: string,
	fromUnit: string,
	toUnit: string,
): Promise<number | null> {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("InvtId", inventoryId)
		.input("FromUnit", fromUnit)
		.input("ToUnit", toUnit)
		.query(`
      SELECT CnvFact, FromUnit, ToUnit
      FROM INUnit
      WHERE InvtId = @InvtId AND FromUnit = @FromUnit AND ToUnit = @ToUnit
    `);
	const row = result.recordset[0] as UnitConvRow | undefined;
	return row ? Number(row.CnvFact) : null;
}

/**
 * Convert a price value from one unit to another using INUnit.
 * INUnit stores: 1 FromUnit = CnvFact × ToUnit.
 * Uses Big.js for precise decimal arithmetic.
 * Returns { convertedPrice, convertedUnit } or the original if no conversion exists.
 */
async function convertPrice(
	inventoryId: string,
	price: Big | number,
	fromUnit: string,
	toUnit: string,
): Promise<{ price: Big; unit: string }> {
	if (fromUnit === toUnit) return { price: toBig(price), unit: fromUnit };

	// Forward: found row where FromUnit = source unit
	// 1 source_unit = factor × target_unit
	// price_per_target = price_per_source / factor  (Big precision)
	const factor = await findConversionFactor(inventoryId, fromUnit, toUnit);
	if (factor !== null) {
		return { price: toBig(price).div(factor), unit: toUnit };
	}

	// Reverse: found row where FromUnit = target unit
	// 1 target_unit = reverseFactor × source_unit
	// price_per_target = price_per_source × reverseFactor  (Big precision)
	const reverseFactor = await findConversionFactor(inventoryId, toUnit, fromUnit);
	if (reverseFactor !== null) {
		return { price: toBig(price).times(reverseFactor), unit: toUnit };
	}

	// No conversion found — return original
	return { price: toBig(price), unit: fromUnit };
}

// ─── Main paginated query ─────────────────────────────────────────────

/**
 * Fetch paginated price records.
 *
 * For each inventory item, returns the current price (valid_to IS NULL)
 * along with its history (valid_to IS NOT NULL).
 *
 * @param page    Page number (1-based).
 * @param limit   Rows per page.
 * @param search  Optional search across InvtID, ClassID, Descr.
 * @param reqUnit Optional target unit to convert prices into.
 */
export const getPricesPaginated = async (
	page: number,
	limit: number,
	search?: string,
	reqUnit?: string,
): Promise<PaginatedResponse<PriceRecord>> => {
	const pool = await getDb();
	const offset = (page - 1) * limit;

	const conditions: string[] = [];
	const hasSearch = search != null && search.trim().length > 0;

	if (hasSearch) {
		conditions.push(`(i.InvtID LIKE @search OR i.ClassID LIKE @search OR i.Descr LIKE @search)`);
	}

	const whereClause =
		conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

	// Current price subquery: only rows where valid_to IS NULL
	// Pick one price per inventory_id (latest id)
	const currentPriceSubQ = `
    SELECT id, inventory_id, price, unit, price_class, valid_from, valid_to
    FROM (
      SELECT id, inventory_id, price, unit, price_class, valid_from, valid_to,
        ROW_NUMBER() OVER (PARTITION BY inventory_id ORDER BY id DESC) AS _rn
      FROM SMR_ItemPrice
      WHERE valid_to IS NULL
    ) _cc
    WHERE _rn = 1
  `;

	// Count query
	const countQuery = `
    SELECT COUNT(*) AS _total
    FROM Inventory i
    ${whereClause}
  `;

	// Data query with current prices
	const dataQuery = `
    SELECT * FROM (
      SELECT ROW_NUMBER() OVER (ORDER BY i.InvtID) AS _row_num,
        ip.id AS item_price_id,
        i.InvtID AS inventory_id,
        i.ClassID AS class_id,
        i.Descr AS description,
        ip.price,
        ip.unit,
        ip.price_class
      FROM Inventory i
      LEFT JOIN (${currentPriceSubQ}) ip ON i.InvtID = ip.inventory_id
      ${whereClause}
    ) AS _paginated
    WHERE _row_num BETWEEN @_offset + 1 AND @_offset + @_limit
    ORDER BY _row_num
  `;

	// Execute count
	const countReq = pool.request();
	if (hasSearch) countReq.input("search", `%${search.trim()}%`);
	const countResult = await countReq.query(countQuery);
	const total = Number(countResult.recordset[0]?._total) || 0;

	// Count of inventory items without any current price
	const noPriceCountQuery = `
    SELECT COUNT(*) AS _cnt
    FROM Inventory i
    WHERE NOT EXISTS (
      SELECT 1 FROM SMR_ItemPrice ip
      WHERE ip.inventory_id = i.InvtID AND ip.valid_to IS NULL
    )
    ${hasSearch ? `AND (i.InvtID LIKE @search OR i.ClassID LIKE @search OR i.Descr LIKE @search)` : ``}
  `;
	const noPriceReq = pool.request();
	if (hasSearch) noPriceReq.input("search", `%${search.trim()}%`);
	const noPriceResult = await noPriceReq.query(noPriceCountQuery);
	const withoutPriceCount = Number(noPriceResult.recordset[0]?._cnt) || 0;

	if (total === 0) {
		return { data: [], total: 0, page, limit, totalPages: 1, withoutPriceCount };
	}

	// Execute data
	const dataReq = pool.request();
	if (hasSearch) dataReq.input("search", `%${search.trim()}%`);
	dataReq.input("_offset", offset);
	dataReq.input("_limit", limit);
	const dataResult = await dataReq.query(dataQuery);

	type RawRow = {
		item_price_id: number | null;
		inventory_id: string;
		class_id: string | null;
		description: string | null;
		price: number | null;
		unit: string | null;
		price_class: string | null;
	};

	const rawRows = trimStrings(dataResult.recordset as RawRow[]);

	// Collect inventory IDs for history batch query
	const invIds = rawRows.map((r) => r.inventory_id);

	// Batch fetch history for all returned inventory items
	const historyMap = new Map<string, PriceHistoryEntry[]>();
	if (invIds.length > 0) {
		const historyReq = pool.request();
		const idParams = invIds.map((id, idx) => {
			const paramName = `_id${idx}`;
			historyReq.input(paramName, id);
			return `@${paramName}`;
		});

		const historyResult = await historyReq.query(`
      SELECT
        ip.inventory_id,
        ip.price,
        ip.unit,
        ip.valid_from,
        ip.valid_to
      FROM SMR_ItemPrice ip
      WHERE ip.inventory_id IN (${idParams.join(", ")})
      ORDER BY ip.inventory_id, ip.valid_from DESC
    `);

		type HistoryRaw = {
			inventory_id: string;
			price: number;
			unit: string;
			valid_from: string;
			valid_to: string | null;
		};

		const historyRows = trimStrings(historyResult.recordset as HistoryRaw[]);
		for (const h of historyRows) {
			const existing = historyMap.get(h.inventory_id) ?? [];
			existing.push({
				valid_from: h.valid_from,
				valid_to: h.valid_to,
				price: toBig(h.price),
				unit: h.unit,
			});
			historyMap.set(h.inventory_id, existing);
		}
	}

	// Build final response
	const data: PriceRecord[] = [];
	for (const row of rawRows) {
		let effectivePrice: Big | null = row.price != null ? toBig(row.price) : null;
		let effectiveUnit = row.unit;

		// Unit conversion if requested
		if (reqUnit && row.price !== null && row.unit) {
			const converted = await convertPrice(
				row.inventory_id,
				effectivePrice!,
				row.unit,
				reqUnit,
			);
			effectivePrice = converted.price;
			effectiveUnit = converted.unit;
		}

		const history: PriceHistoryEntry[] =
			historyMap.get(row.inventory_id) ?? [];

		data.push({
			item_price_id: row.item_price_id,
			inventory_id: row.inventory_id,
			class_id: row.class_id,
			description: row.description,
			price: effectivePrice,
			unit: effectiveUnit,
			price_class: row.price_class,
			history,
		});
	}

	return {
		data,
		total,
		withoutPriceCount,
		page,
		limit,
		totalPages: Math.ceil(total / limit) || 1,
	};
};

// ─── Exported constants ────────────────────────────────────────────────

export { MAX_LIMIT, DEFAULT_LIMIT };

// ─── Bulk import ──────────────────────────────────────────────────────

/**
 * Import item prices from an array of rows (parsed from Excel).
 *
 * For each row:
 *  - If inventory_id already has a current price (valid_to IS NULL), expire it.
 *    Set the old current price's valid_to to 1 second before the new valid_from,
 *    then insert the new price.
 *  - If no current price exists, insert a new row.
 *  - Unit is normalized to "CS" if a conversion factor exists in INUnit.
 *  - valid_from defaults to current datetime if not provided.
 *
 * Returns a summary of processed/inserted/updated/errors.
 */
export const importItemPrices = async (
	items: BulkImportItem[],
): Promise<ImportResult> => {
	const pool = await getDb();
	let inserted = 0;
	let updated = 0;

	const errors: Array<{ row: number; message: string }> = [];

	for (let i = 0; i < items.length; i++) {
		const item = items[i]!;
		const rowNum = i + 2; // Excel rows are 1-based + header

		if (!item.inventory_id || item.price == null || !item.unit || !item.price_class) {
			errors.push({ row: rowNum, message: "Missing required fields (inventory_id, price, unit, price_class)" });
			continue;
		}

		try {
			// Check if inventory exists
			const invCheck = await pool
				.request()
				.input("invtId", item.inventory_id)
				.query("SELECT COUNT(*) AS _cnt FROM Inventory WHERE InvtID = @invtId");
			if (Number(invCheck.recordset[0]?._cnt) === 0) {
				errors.push({ row: rowNum, message: `Inventory '${item.inventory_id}' not found` });
				continue;
			}

			// Check if price_class exists
			const pcCheck = await pool
				.request()
				.input("priceClass", item.price_class)
				.query("SELECT COUNT(*) AS _cnt FROM SMR_PriceClass WHERE id = @priceClass");
			if (Number(pcCheck.recordset[0]?._cnt) === 0) {
				errors.push({ row: rowNum, message: `Price class '${item.price_class}' not found` });
				continue;
			}

			// Default valid_from to current datetime
			const validFrom = item.valid_from ?? toMsSqlDatetime(new Date());

			// Normalize unit to CS if possible
			const normalized = await normalizeToCsUnit(item.inventory_id, item.price, item.unit);

			// Find current price for this inventory item
			const current = await pool
				.request()
				.input("invId", item.inventory_id)
				.query(`
          SELECT id, price, unit, price_class, valid_from, valid_to
          FROM SMR_ItemPrice
          WHERE inventory_id = @invId AND valid_to IS NULL
        `);

			if (current.recordset.length > 0) {
				// Expire the old current price — 1 second before new valid_from
				const oldValidTo = oneSecondBefore(validFrom);
				await pool
					.request()
					.input("id", current.recordset[0].id)
					.input("valid_to", oldValidTo)
					.query("UPDATE SMR_ItemPrice SET valid_to = @valid_to WHERE id = @id");
				updated++;
			}

			// Insert new price
			await pool
				.request()
				.input("inventory_id", item.inventory_id)
				.input("price", bigToNumber(normalized.price))
				.input("unit", normalized.unit)
				.input("price_class", item.price_class)
				.input("valid_from", validFrom)
				.input("valid_to", item.valid_to ?? null)
				.query(`
          INSERT INTO SMR_ItemPrice (inventory_id, price, unit, price_class, valid_from, valid_to)
          VALUES (@inventory_id, @price, @unit, @price_class, @valid_from, @valid_to)
        `);
			inserted++;
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Unknown error";
			errors.push({ row: rowNum, message: msg });
		}
	}

	return {
		processed: items.length,
		inserted,
		updated,
		errors,
	};
};

// ─── Backward-compat exports ──────────────────────────────────────────

/**
 * Legacy alias — returns distinct price_class values from SMR_PriceClass.
 * Replaces the old getDistinctCatalogNbr from SlsPrc.
 */
export const getDistinctCatalogNbr = async (): Promise<string[]> => {
	return getDistinctPriceClasses();
};

/** @deprecated Use createItemPrice instead */
export const createItemCost = createItemPrice;

/** @deprecated Use getItemPriceById instead */
export const getItemCostById = getItemPriceById;

/** @deprecated Use getItemPricesByInventoryId instead */
export const getItemCostsByInventoryId = getItemPricesByInventoryId;

/** @deprecated Use updateItemPrice instead */
export const updateItemCost = updateItemPrice;

/** @deprecated Use deleteItemPrice instead */
export const deleteItemCost = deleteItemPrice;

/** @deprecated Use expireItemPrice instead */
export const expireItemCost = expireItemPrice;

/** @deprecated Use importItemPrices instead */
export const importItemCosts = importItemPrices;

/** @deprecated Use getPriceClassById instead */
export const getPriceClassHistory = getPriceClassById;
