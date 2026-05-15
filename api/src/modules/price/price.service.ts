import { getDb } from "../../config/db";
import { NotFoundError } from "../../middlewares/error";
import { trimStrings } from "../../utils/trimStrings";
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
} from "./price.schema";

// ─── Constants ─────────────────────────────────────────────────────────

const MAX_LIMIT = 10_000;
const DEFAULT_LIMIT = 500;

// ─── SMR_ItemCost CRUD ────────────────────────────────────────────────

export const createItemCost = async (item: NewItemCost): Promise<ItemCost> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("inventory_id", item.inventory_id)
		.input("cost", item.cost)
		.input("unit", item.unit)
		.input("valid_from", item.valid_from)
		.input("valid_to", item.valid_to ?? null)
		.query(`
      INSERT INTO SMR_ItemCost (inventory_id, cost, unit, valid_from, valid_to)
      OUTPUT INSERTED.id, INSERTED.inventory_id, INSERTED.cost, INSERTED.unit, INSERTED.valid_from, INSERTED.valid_to
      VALUES (@inventory_id, @cost, @unit, @valid_from, @valid_to)
    `);

	const created = result.recordset[0];
	if (!created) throw new Error("Failed to create ItemCost");
	return trimStrings(created as ItemCost);
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
	return trimStrings(result.recordset[0] as ItemCost | undefined);
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
	return trimStrings(result.recordset as ItemCost[]);
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
	if (updates.cost !== undefined) req.input("cost", updates.cost);
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
	return trimStrings(result.recordset[0] as ItemCost);
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

// ─── SMR_PriceClass CRUD ─────────────────────────────────────────────

export const createPriceClass = async (
	pc: NewPriceClass,
): Promise<PriceClass> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("price_class", pc.price_class)
		.input("pct_discount", pc.pct_discount)
		.input("valid_from", pc.valid_from)
		.input("valid_to", pc.valid_to ?? null)
		.query(`
      INSERT INTO SMR_PriceClass (price_class, pct_discount, valid_from, valid_to)
      OUTPUT INSERTED.price_class, INSERTED.pct_discount, INSERTED.valid_from, INSERTED.valid_to
      VALUES (@price_class, @pct_discount, @valid_from, @valid_to)
    `);

	const created = result.recordset[0];
	if (!created) throw new Error("Failed to create PriceClass");
	return trimStrings(created as PriceClass);
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
	return trimStrings(result.recordset as PriceClass[]);
};

export const getCurrentPriceClasses = async (): Promise<PriceClass[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.query(`
      SELECT price_class, pct_discount, valid_from, valid_to
      FROM SMR_PriceClass
      WHERE valid_to IS NULL
      ORDER BY price_class
    `);
	return trimStrings(result.recordset as PriceClass[]);
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
	priceClass: string,
	validFrom: string,
	updates: PriceClassUpdate,
): Promise<PriceClass> => {
	const pool = await getDb();
	const setClauses: string[] = [];
	if (updates.pct_discount !== undefined) setClauses.push("pct_discount = @pct_discount");
	if (updates.valid_to !== undefined) setClauses.push("valid_to = @valid_to");

	if (setClauses.length === 0) {
		throw new NotFoundError(`No updates provided for PriceClass ${priceClass}`);
	}

	const req = pool.request()
		.input("price_class", priceClass)
		.input("valid_from", validFrom);
	if (updates.pct_discount !== undefined) req.input("pct_discount", updates.pct_discount);
	if (updates.valid_to !== undefined) req.input("valid_to", updates.valid_to);

	const result = await req.query(`
      UPDATE SMR_PriceClass
      SET ${setClauses.join(", ")}
      OUTPUT INSERTED.price_class, INSERTED.pct_discount, INSERTED.valid_from, INSERTED.valid_to
      WHERE price_class = @price_class AND valid_from = @valid_from
    `);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`PriceClass ${priceClass} / ${validFrom} not found`);
	}
	return trimStrings(result.recordset[0] as PriceClass);
};

export const deletePriceClass = async (
	priceClass: string,
	validFrom: string,
): Promise<void> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("price_class", priceClass)
		.input("valid_from", validFrom)
		.query(`
      DELETE FROM SMR_PriceClass
      OUTPUT DELETED.price_class
      WHERE price_class = @price_class AND valid_from = @valid_from
    `);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`PriceClass ${priceClass} / ${validFrom} not found`);
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
 * Returns { convertedCost, convertedUnit } or the original if no conversion exists.
 */
async function convertCost(
	inventoryId: string,
	cost: number,
	fromUnit: string,
	toUnit: string,
): Promise<{ cost: number; unit: string }> {
	if (fromUnit === toUnit) return { cost, unit: fromUnit };

	const factor = await findConversionFactor(inventoryId, fromUnit, toUnit);
	if (factor !== null) {
		return { cost: cost * factor, unit: toUnit };
	}

	// Try reverse direction
	const reverseFactor = await findConversionFactor(inventoryId, toUnit, fromUnit);
	if (reverseFactor !== null) {
		return { cost: cost / reverseFactor, unit: toUnit };
	}

	// No conversion found — return original
	return { cost, unit: fromUnit };
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
	const row = result.recordset[0] as PriceClass | undefined;
	return row ? trimStrings(row) : null;
}

// ─── Main paginated query ─────────────────────────────────────────────

/**
 * Fetch paginated price records.
 *
 * For each inventory item, returns the current cost (valid_to IS NULL)
 * along with its history (valid_to IS NOT NULL).
 *
 * @param page       Page number (1-based).
 * @param limit      Rows per page.
 * @param search     Optional search across InvtID, ClassID, Descr, price_class.
 * @param reqUnit    Optional target unit to convert costs into.
 * @param priceClass Optional price class filter.
 */
export const getPricesPaginated = async (
	page: number,
	limit: number,
	search?: string,
	reqUnit?: string,
	priceClass?: string,
): Promise<PaginatedResponse<PriceRecord>> => {
	const pool = await getDb();
	const offset = (page - 1) * limit;

	const conditions: string[] = [];
	const hasSearch = search != null && search.trim().length > 0;
	const hasPriceClass = priceClass != null && priceClass.trim().length > 0;

	if (hasSearch) {
		conditions.push(`(i.InvtID LIKE @search OR i.ClassID LIKE @search OR i.Descr LIKE @search)`);
	}
	if (hasPriceClass) {
		conditions.push(`i.ClassID = @priceClass`);
	}

	const whereClause =
		conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

	// Current cost subquery: only rows where valid_to IS NULL
	// Pick one cost per inventory_id (latest id)
	const currentCostSubQ = `
    SELECT inventory_id, cost, unit, valid_from, valid_to
    FROM (
      SELECT inventory_id, cost, unit, valid_from, valid_to,
        ROW_NUMBER() OVER (PARTITION BY inventory_id ORDER BY id DESC) AS _rn
      FROM SMR_ItemCost
      WHERE valid_to IS NULL
    ) _cc
    WHERE _rn = 1
  `;

	// Price class discount: only join when price_class param is provided
	const hasPc = hasPriceClass;
	const priceClassJoin = hasPc
		? `LEFT JOIN SMR_PriceClass pc ON pc.price_class = @priceClass AND pc.valid_to IS NULL`
		: ``;
	const priceClassSelect = hasPc
		? `pc.price_class, pc.pct_discount, CAST(ic.cost * (1 - ISNULL(pc.pct_discount, 0)) AS NUMERIC(18,4)) AS discount_price`
		: `CAST(NULL AS NVARCHAR(30)) AS price_class, CAST(NULL AS NUMERIC(18,4)) AS pct_discount, CAST(NULL AS NUMERIC(18,4)) AS discount_price`;

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
        i.InvtID AS inventory_id,
        i.ClassID AS class_id,
        i.Descr AS description,
        ic.cost,
        ic.unit,
        ic.valid_from,
        ic.valid_to,
        ${priceClassSelect}
      FROM Inventory i
      LEFT JOIN (${currentCostSubQ}) ic ON i.InvtID = ic.inventory_id
      ${priceClassJoin}
      ${whereClause}
    ) AS _paginated
    WHERE _row_num BETWEEN @_offset + 1 AND @_offset + @_limit
    ORDER BY _row_num
  `;

	// Execute count
	const countReq = pool.request();
	if (hasSearch) countReq.input("search", `%${search.trim()}%`);
	if (hasPriceClass) countReq.input("priceClass", priceClass!.trim());
	const countResult = await countReq.query(countQuery);
	const total = Number(countResult.recordset[0]?._total) || 0;

	if (total === 0) {
		return { data: [], total: 0, page, limit, totalPages: 1 };
	}

	// Execute data
	const dataReq = pool.request();
	if (hasSearch) dataReq.input("search", `%${search.trim()}%`);
	if (hasPriceClass) dataReq.input("priceClass", priceClass!.trim());
	dataReq.input("_offset", offset);
	dataReq.input("_limit", limit);
	const dataResult = await dataReq.query(dataQuery);

	type RawRow = {
		inventory_id: string;
		class_id: string | null;
		description: string | null;
		cost: number | null;
		unit: string | null;
		valid_from: string | null;
		valid_to: string | null;
		price_class: string | null;
		pct_discount: number | null;
		discount_price: number | null;
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

		// If priceClass provided, join with SMR_PriceClass to calculate historical discounts
		// using the price_class parameter value
		const historyPcSelect = hasPriceClass
			? `@priceClass AS price_class, pc.pct_discount, CAST(ic.cost * (1 - ISNULL(pc.pct_discount, 0)) AS NUMERIC(18,4)) AS discount_price`
			: `CAST(NULL AS NVARCHAR(30)) AS price_class, CAST(NULL AS NUMERIC(18,4)) AS pct_discount, CAST(NULL AS NUMERIC(18,4)) AS discount_price`;

		const historyPcJoin = hasPriceClass
			? `LEFT JOIN SMR_PriceClass pc ON pc.price_class = @priceClass AND pc.valid_from <= ic.valid_from AND (pc.valid_to IS NULL OR pc.valid_to > ic.valid_from)`
			: ``;

		if (hasPriceClass) historyReq.input("priceClass", priceClass!.trim());

		const historyResult = await historyReq.query(`
      SELECT
        ic.inventory_id,
        ic.cost,
        ic.unit,
        ic.valid_from,
        ic.valid_to,
        ${historyPcSelect}
      FROM SMR_ItemCost ic
      ${historyPcJoin}
      WHERE ic.inventory_id IN (${idParams.join(", ")})
      ORDER BY ic.inventory_id, ic.valid_from DESC
    `);

		type HistoryRaw = {
			inventory_id: string;
			cost: number;
			unit: string;
			valid_from: string;
			valid_to: string | null;
			price_class: string | null;
			pct_discount: number | null;
			discount_price: number | null;
		};

		const historyRows = trimStrings(historyResult.recordset as HistoryRaw[]);
		for (const h of historyRows) {
			const existing = historyMap.get(h.inventory_id) ?? [];
			existing.push({
				valid_from: h.valid_from,
				valid_to: h.valid_to,
				cost: h.cost,
				unit: h.unit,
				price_class: h.price_class,
				discount_price: h.discount_price,
			});
			historyMap.set(h.inventory_id, existing);
		}
	}

	// Build final response
	const data: PriceRecord[] = [];
	for (const row of rawRows) {
		let effectiveCost = row.cost;
		let effectiveUnit = row.unit;
		let effectiveDiscount = row.discount_price;

		// Unit conversion if requested
		if (reqUnit && row.cost !== null && row.unit) {
			const converted = await convertCost(
				row.inventory_id,
				row.cost,
				row.unit,
				reqUnit,
			);
			effectiveCost = converted.cost;
			effectiveUnit = converted.unit;
			if (row.pct_discount !== null) {
				effectiveDiscount = Math.round(
					converted.cost * (1 - row.pct_discount) * 10000,
				) / 10000;
			}
		}

		data.push({
			inventory_id: row.inventory_id,
			class_id: row.class_id,
			description: row.description,
			cost: effectiveCost,
			unit: effectiveUnit,
			price_class: row.price_class,
			pct_discount: row.pct_discount,
			discount_price: effectiveDiscount,
			history: historyMap.get(row.inventory_id) ?? [],
		});
	}

	return {
		data,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit) || 1,
	};
};

// ─── Exported constants ────────────────────────────────────────────────

export { MAX_LIMIT, DEFAULT_LIMIT };

// ─── Backward-compat exports (for lookups.service.ts and any other importers) ──

/**
 * Legacy alias — returns distinct price_class values from SMR_PriceClass.
 * Replaces the old getDistinctCatalogNbr from SlsPrc.
 */
export const getDistinctCatalogNbr = async (): Promise<string[]> => {
	return getDistinctPriceClasses();
};
