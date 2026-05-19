import { getDb } from "../../config/db";
import { BadRequestError, NotFoundError } from "../../middlewares/error";
import { trimStrings } from "../../utils/trimStrings";
import Big from "big.js";
import { toBig, bigToNumber } from "./price.schema";
import type {
	ItemCost,
	NewItemCost,
	ItemCostUpdate,
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
 * Returns { cost, unit } with CS unit and converted cost if possible,
 * otherwise returns the original values.
 */
async function normalizeToCsUnit(
	inventoryId: string,
	cost: Big | number,
	unit: string,
): Promise<{ cost: Big; unit: string }> {
	if (unit.toUpperCase() === "CS") return { cost: toBig(cost), unit };

	// Forward: found row where FromUnit = current unit, ToUnit = CS
	// 1 current_unit = factor × CS → cost_per_CS = cost_per_current / factor (Big precision)
	const factor = await findConversionFactor(inventoryId, unit, "CS");
	if (factor !== null) {
		return { cost: toBig(cost).div(factor), unit: "CS" };
	}

	// Reverse: found row where FromUnit = CS, ToUnit = current unit
	// 1 CS = reverseFactor × current_unit → cost_per_CS = cost_per_current × reverseFactor (Big precision)
	const reverseFactor = await findConversionFactor(inventoryId, "CS", unit);
	if (reverseFactor !== null) {
		return { cost: toBig(cost).times(reverseFactor), unit: "CS" };
	}

	// No conversion available — keep original
	return { cost: toBig(cost), unit };
}

// ─── Constants ─────────────────────────────────────────────────────────

const MAX_LIMIT = 10_000;
const DEFAULT_LIMIT = 500;

// ─── SMR_ItemCost CRUD ────────────────────────────────────────────────

export const createItemCost = async (item: NewItemCost): Promise<ItemCost> => {
	const pool = await getDb();
	const validFrom = item.valid_from ?? toMsSqlDatetime(new Date());

	// Normalize unit to CS if possible
	const normalized = await normalizeToCsUnit(item.inventory_id, item.cost, item.unit);

	const result = await pool
		.request()
		.input("inventory_id", item.inventory_id)
		.input("cost", bigToNumber(normalized.cost))
		.input("unit", normalized.unit)
		.input("valid_from", validFrom)
		.input("valid_to", item.valid_to ?? null)
		.query(`
      INSERT INTO SMR_ItemCost (inventory_id, cost, unit, valid_from, valid_to)
      OUTPUT INSERTED.id, INSERTED.inventory_id, INSERTED.cost, INSERTED.unit, INSERTED.valid_from, INSERTED.valid_to
      VALUES (@inventory_id, @cost, @unit, @valid_from, @valid_to)
    `);

	const created = result.recordset[0];
	if (!created) throw new Error("Failed to create ItemCost");
	return {
		...trimStrings(created as Record<string, unknown>),
		cost: toBig((created as Record<string, unknown>).cost),
	} as unknown as ItemCost;
};

export const getItemCostById = async (
	id: number,
): Promise<ItemCost | undefined> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("id", id)
		.query(
			"SELECT id, inventory_id, cost, unit, valid_from, valid_to FROM SMR_ItemCost WHERE id = @id",
		);
	const raw = result.recordset[0] as Record<string, unknown> | undefined;
	if (!raw) return undefined;
	return {
		...trimStrings(raw),
		cost: toBig(raw.cost),
	} as unknown as ItemCost;
};

export const getItemCostsByInventoryId = async (
	inventoryId: string,
): Promise<ItemCost[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("inventory_id", inventoryId)
		.query(`
      SELECT id, inventory_id, cost, unit, valid_from, valid_to
      FROM SMR_ItemCost
      WHERE inventory_id = @inventory_id
      ORDER BY valid_from DESC
    `);
	const raw = result.recordset as Record<string, unknown>[];
	return raw.map((r) => ({
		...trimStrings(r),
		cost: toBig(r.cost),
	})) as unknown as ItemCost[];
};

export const updateItemCost = async (
	id: number,
	updates: ItemCostUpdate,
): Promise<ItemCost> => {
	const pool = await getDb();
	const setClauses: string[] = [];
	if (updates.cost !== undefined) setClauses.push("cost = @cost");
	if (updates.unit !== undefined) setClauses.push("unit = @unit");
	if (updates.valid_to !== undefined) setClauses.push("valid_to = @valid_to");

	if (setClauses.length === 0) {
		const existing = await getItemCostById(id);
		if (!existing) throw new NotFoundError(`ItemCost ${id} not found`);
		return existing;
	}

	const req = pool.request().input("id", id);
	if (updates.cost !== undefined) req.input("cost", bigToNumber(toBig(updates.cost)));
	if (updates.unit !== undefined) req.input("unit", updates.unit);
	if (updates.valid_to !== undefined) req.input("valid_to", updates.valid_to);

	const result = await req.query(`
      UPDATE SMR_ItemCost
      SET ${setClauses.join(", ")}
      OUTPUT INSERTED.id, INSERTED.inventory_id, INSERTED.cost, INSERTED.unit, INSERTED.valid_from, INSERTED.valid_to
      WHERE id = @id
    `);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`ItemCost ${id} not found`);
	}
	const raw = result.recordset[0] as Record<string, unknown>;
	return {
		...trimStrings(raw),
		cost: toBig(raw.cost),
	} as unknown as ItemCost;
};

export const deleteItemCost = async (id: number): Promise<void> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("id", id)
		.query("DELETE FROM SMR_ItemCost OUTPUT DELETED.id WHERE id = @id");

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`ItemCost ${id} not found`);
	}
};

/**
 * Set valid_to on an existing ItemCost (used when replacing with a newer entry).
 * This expires the old cost record 1 second before the new cost's valid_from.
 */
export const expireItemCost = async (id: number, validTo: string): Promise<void> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("id", id)
		.input("valid_to", validTo)
		.query("UPDATE SMR_ItemCost SET valid_to = @valid_to WHERE id = @id");

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`ItemCost ${id} not found`);
	}
};

// ─── SMR_PriceClass CRUD ─────────────────────────────────────────────

export const createPriceClass = async (
	pc: NewPriceClass,
): Promise<PriceClass> => {
	const pool = await getDb();

	// Prevent duplicate active price_class name
	const existing = await pool
		.request()
		.input("price_class", pc.price_class)
		.query(`
      SELECT COUNT(*) AS _cnt
      FROM SMR_PriceClass
      WHERE price_class = @price_class AND valid_to IS NULL
    `);
	if (Number(existing.recordset[0]?._cnt) > 0) {
		throw new BadRequestError(
			`Price class '${pc.price_class}' already has an active entry. Expire it first before creating a new one.`,
		);
	}

	const result = await pool
		.request()
		.input("price_class", pc.price_class)
		.input("pct_discount", bigToNumber(toBig(pc.pct_discount)))
		.input("valid_from", pc.valid_from)
		.input("valid_to", pc.valid_to ?? null)
		.query(`
      INSERT INTO SMR_PriceClass (price_class, pct_discount, valid_from, valid_to)
      OUTPUT INSERTED.id, INSERTED.price_class, INSERTED.pct_discount, INSERTED.valid_from, INSERTED.valid_to
      VALUES (@price_class, @pct_discount, @valid_from, @valid_to)
    `);

	const created = result.recordset[0];
	if (!created) throw new Error("Failed to create PriceClass");
	const raw = created as Record<string, unknown>;
	return {
		...trimStrings(raw),
		pct_discount: toBig(raw.pct_discount),
	} as unknown as PriceClass;
};

export const getPriceClasses = async (): Promise<PriceClass[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.query(`
      SELECT price_class, pct_discount, valid_from, valid_to
      FROM SMR_PriceClass
      ORDER BY price_class, valid_from DESC
    `);
	const raw = result.recordset as Record<string, unknown>[];
	return raw.map((r) => ({
		...trimStrings(r),
		pct_discount: toBig(r.pct_discount),
	})) as unknown as PriceClass[];
};

export const getCurrentPriceClasses = async (): Promise<PriceClass[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.query(`
      SELECT id, price_class, pct_discount, valid_from, valid_to
      FROM SMR_PriceClass
      WHERE valid_to IS NULL
      ORDER BY price_class
    `);
	const raw = result.recordset as Record<string, unknown>[];
	return raw.map((r) => ({
		...trimStrings(r),
		pct_discount: toBig(r.pct_discount),
	})) as unknown as PriceClass[];
};

/** Returns ALL price class entries (current + history) ordered by price_class, valid_from DESC */
export const getAllPriceClasses = async (): Promise<PriceClass[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.query(`
      SELECT id, price_class, pct_discount, valid_from, valid_to
      FROM SMR_PriceClass
      ORDER BY price_class, valid_from DESC
    `);
	const raw = result.recordset as Record<string, unknown>[];
	return raw.map((r) => ({
		...trimStrings(r),
		pct_discount: toBig(r.pct_discount),
	})) as unknown as PriceClass[];
};

/** Returns all entries (expired + current) for a specific price_class name */
export const getPriceClassHistory = async (
	priceClass: string,
): Promise<PriceClass[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("price_class", priceClass)
		.query(`
      SELECT id, price_class, pct_discount, valid_from, valid_to
      FROM SMR_PriceClass
      WHERE price_class = @price_class
      ORDER BY valid_from DESC
    `);
	const raw = result.recordset as Record<string, unknown>[];
	return raw.map((r) => ({
		...trimStrings(r),
		pct_discount: toBig(r.pct_discount),
	})) as unknown as PriceClass[];
};

export const getDistinctPriceClasses = async (): Promise<string[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.query(`
      SELECT DISTINCT price_class
      FROM SMR_PriceClass
      ORDER BY price_class
    `);
	const rows = result.recordset as Array<{ price_class: string }>;
	return trimStrings(rows.map((r) => r.price_class));
};

export const updatePriceClass = async (
	id: number,
	updates: PriceClassUpdate,
): Promise<PriceClass> => {
	const pool = await getDb();
	const setClauses: string[] = [];
	if (updates.pct_discount !== undefined) setClauses.push("pct_discount = @pct_discount");
	if (updates.valid_to !== undefined) setClauses.push("valid_to = @valid_to");

	if (setClauses.length === 0) {
		throw new NotFoundError(`No updates provided for PriceClass ${id}`);
	}

	const req = pool.request()
		.input("id", id);
	if (updates.pct_discount !== undefined) req.input("pct_discount", bigToNumber(toBig(updates.pct_discount)));
	if (updates.valid_to !== undefined) req.input("valid_to", updates.valid_to);

	const result = await req.query(`
      UPDATE SMR_PriceClass
      SET ${setClauses.join(", ")}
      OUTPUT INSERTED.id, INSERTED.price_class, INSERTED.pct_discount, INSERTED.valid_from, INSERTED.valid_to
      WHERE id = @id
    `);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`PriceClass ${id} not found`);
	}
	const raw = result.recordset[0] as Record<string, unknown>;
	return {
		...trimStrings(raw),
		pct_discount: toBig(raw.pct_discount),
	} as unknown as PriceClass;
};

export const deletePriceClass = async (id: number): Promise<void> => {
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
		throw new NotFoundError(`PriceClass ${id} not found`);
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
 * Convert a cost value from one unit to another using INUnit.
 * INUnit stores: 1 FromUnit = CnvFact × ToUnit.
 * Uses Big.js for precise decimal arithmetic.
 * Returns { convertedCost, convertedUnit } or the original if no conversion exists.
 */
async function convertCost(
	inventoryId: string,
	cost: Big | number,
	fromUnit: string,
	toUnit: string,
): Promise<{ cost: Big; unit: string }> {
	if (fromUnit === toUnit) return { cost: toBig(cost), unit: fromUnit };

	// Forward: found row where FromUnit = source unit
	// 1 source_unit = factor × target_unit
	// cost_per_target = cost_per_source / factor  (Big precision)
	const factor = await findConversionFactor(inventoryId, fromUnit, toUnit);
	if (factor !== null) {
		return { cost: toBig(cost).div(factor), unit: toUnit };
	}

	// Reverse: found row where FromUnit = target unit
	// 1 target_unit = reverseFactor × source_unit
	// cost_per_target = cost_per_source × reverseFactor  (Big precision)
	const reverseFactor = await findConversionFactor(inventoryId, toUnit, fromUnit);
	if (reverseFactor !== null) {
		return { cost: toBig(cost).times(reverseFactor), unit: toUnit };
	}

	// No conversion found — return original
	return { cost: toBig(cost), unit: fromUnit };
}

// ─── Price query (the core) ──────────────────────────────────────────

/**
 * Determine which SMR_PriceClass row applies for a given date.
 * Uses valid_from <= targetDate AND (valid_to IS NULL OR valid_to > targetDate).
 */
async function findPriceClassForDate(
	priceClass: string,
	targetDate: string,
): Promise<PriceClass | null> {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("price_class", priceClass)
		.input("target_date", targetDate)
		.query(`
      SELECT price_class, pct_discount, valid_from, valid_to
      FROM SMR_PriceClass
      WHERE price_class = @price_class
        AND valid_from <= @target_date
        AND (valid_to IS NULL OR valid_to > @target_date)
      ORDER BY valid_from DESC
    `);
	const row = result.recordset[0] as Record<string, unknown> | undefined;
	if (!row) return null;
	return {
		...trimStrings(row),
		pct_discount: toBig(row.pct_discount),
	} as unknown as PriceClass;
}

// ─── Main paginated query ─────────────────────────────────────────────

/**
 * Fetch paginated price records.
 *
 * For each inventory item, returns the current cost (valid_to IS NULL)
 * along with its history (valid_to IS NOT NULL).
 *
 * @param page    Page number (1-based).
 * @param limit   Rows per page.
 * @param search  Optional search across InvtID, ClassID, Descr.
 * @param reqUnit Optional target unit to convert costs into.
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

	// Current cost subquery: only rows where valid_to IS NULL
	// Pick one cost per inventory_id (latest id)
	const currentCostSubQ = `
    SELECT id, inventory_id, cost, unit, valid_from, valid_to
    FROM (
      SELECT id, inventory_id, cost, unit, valid_from, valid_to,
        ROW_NUMBER() OVER (PARTITION BY inventory_id ORDER BY id DESC) AS _rn
      FROM SMR_ItemCost
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

	// Data query with current costs
	const dataQuery = `
    SELECT * FROM (
      SELECT ROW_NUMBER() OVER (ORDER BY i.InvtID) AS _row_num,
        ic.id AS item_cost_id,
        i.InvtID AS inventory_id,
        i.ClassID AS class_id,
        i.Descr AS description,
        ic.cost,
        ic.unit
      FROM Inventory i
      LEFT JOIN (${currentCostSubQ}) ic ON i.InvtID = ic.inventory_id
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

	// Count of inventory items without any current cost
	const noCostCountQuery = `
    SELECT COUNT(*) AS _cnt
    FROM Inventory i
    WHERE NOT EXISTS (
      SELECT 1 FROM SMR_ItemCost ic
      WHERE ic.inventory_id = i.InvtID AND ic.valid_to IS NULL
    )
    ${hasSearch ? `AND (i.InvtID LIKE @search OR i.ClassID LIKE @search OR i.Descr LIKE @search)` : ``}
  `;
	const noCostReq = pool.request();
	if (hasSearch) noCostReq.input("search", `%${search.trim()}%`);
	const noCostResult = await noCostReq.query(noCostCountQuery);
	const withoutCostCount = Number(noCostResult.recordset[0]?._cnt) || 0;

	if (total === 0) {
		return { data: [], total: 0, page, limit, totalPages: 1, withoutCostCount };
	}

	// Execute data
	const dataReq = pool.request();
	if (hasSearch) dataReq.input("search", `%${search.trim()}%`);
	dataReq.input("_offset", offset);
	dataReq.input("_limit", limit);
	const dataResult = await dataReq.query(dataQuery);

	type RawRow = {
		item_cost_id: number | null;
		inventory_id: string;
		class_id: string | null;
		description: string | null;
		cost: number | null;
		unit: string | null;
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
        ic.inventory_id,
        ic.cost,
        ic.unit,
        ic.valid_from,
        ic.valid_to
      FROM SMR_ItemCost ic
      WHERE ic.inventory_id IN (${idParams.join(", ")})
      ORDER BY ic.inventory_id, ic.valid_from DESC
    `);

		type HistoryRaw = {
			inventory_id: string;
			cost: number;
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
				cost: toBig(h.cost),
				unit: h.unit,
			});
			historyMap.set(h.inventory_id, existing);
		}
	}

	// Build final response
	const data: PriceRecord[] = [];
	for (const row of rawRows) {
		let effectiveCost: Big | null = row.cost != null ? toBig(row.cost) : null;
		let effectiveUnit = row.unit;

		// Unit conversion if requested
		if (reqUnit && row.cost !== null && row.unit) {
			const converted = await convertCost(
				row.inventory_id,
				effectiveCost!,
				row.unit,
				reqUnit,
			);
			effectiveCost = converted.cost;
			effectiveUnit = converted.unit;
		}

		const history: PriceHistoryEntry[] =
			historyMap.get(row.inventory_id) ?? [];

		data.push({
			item_cost_id: row.item_cost_id,
			inventory_id: row.inventory_id,
			class_id: row.class_id,
			description: row.description,
			cost: effectiveCost,
			unit: effectiveUnit,
			history,
		});
	}

	return {
		data,
		total,
		withoutCostCount,
		page,
		limit,
		totalPages: Math.ceil(total / limit) || 1,
	};
};

// ─── Exported constants ────────────────────────────────────────────────

export { MAX_LIMIT, DEFAULT_LIMIT };

// ─── Bulk import ──────────────────────────────────────────────────────

/**
 * Import item costs from an array of rows (parsed from Excel).
 *
 * For each row:
 *  - If inventory_id already has a current cost (valid_to IS NULL), expire it.
 *    Set the old current cost's valid_to to 1 second before the new valid_from,
 *    then insert the new cost.
 *  - If no current cost exists, insert a new row.
 *  - Unit is normalized to "CS" if a conversion factor exists in INUnit.
 *  - valid_from defaults to current datetime if not provided.
 *
 * Returns a summary of processed/inserted/updated/errors.
 */
export const importItemCosts = async (
	items: BulkImportItem[],
): Promise<ImportResult> => {
	const pool = await getDb();
	let inserted = 0;
	let updated = 0;

	const errors: Array<{ row: number; message: string }> = [];

	for (let i = 0; i < items.length; i++) {
		const item = items[i]!;
		const rowNum = i + 2; // Excel rows are 1-based + header

		if (!item.inventory_id || item.cost == null || !item.unit) {
			errors.push({ row: rowNum, message: "Missing required fields (inventory_id, cost, unit)" });
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

			// Default valid_from to current datetime
			const validFrom = item.valid_from ?? toMsSqlDatetime(new Date());

			// Normalize unit to CS if possible
			const normalized = await normalizeToCsUnit(item.inventory_id, item.cost, item.unit);

			// Find current cost for this inventory item
			const current = await pool
				.request()
				.input("invId", item.inventory_id)
				.query(`
          SELECT id, cost, unit, valid_from, valid_to
          FROM SMR_ItemCost
          WHERE inventory_id = @invId AND valid_to IS NULL
        `);

			if (current.recordset.length > 0) {
				// Expire the old current cost — 1 second before new valid_from
				const oldValidTo = oneSecondBefore(validFrom);
				await pool
					.request()
					.input("id", current.recordset[0].id)
					.input("valid_to", oldValidTo)
					.query("UPDATE SMR_ItemCost SET valid_to = @valid_to WHERE id = @id");
				updated++;
			}

			// Insert new cost
			await pool
				.request()
				.input("inventory_id", item.inventory_id)
				.input("cost", bigToNumber(normalized.cost))
				.input("unit", normalized.unit)
				.input("valid_from", validFrom)
				.input("valid_to", item.valid_to ?? null)
				.query(`
          INSERT INTO SMR_ItemCost (inventory_id, cost, unit, valid_from, valid_to)
          VALUES (@inventory_id, @cost, @unit, @valid_from, @valid_to)
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

// ─── Backward-compat exports (for lookups.service.ts and any other importers) ──

/**
 * Legacy alias — returns distinct price_class values from SMR_PriceClass.
 * Replaces the old getDistinctCatalogNbr from SlsPrc.
 */
export const getDistinctCatalogNbr = async (): Promise<string[]> => {
	return getDistinctPriceClasses();
};
