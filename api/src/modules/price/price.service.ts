import { withTenantDb } from "../../config/with-tenant-db";
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
	PriceClassEntry,
	PriceRecord,
	PriceHistoryEntry,
	PaginatedResponse,
	BulkImportItem,
	ImportResult,
	ConvertBatchItem,
	ConvertBatchResult,
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
	tenantKey = "default",
): Promise<{ price: Big; unit: string }> {
	if (unit.toUpperCase() === "CS") return { price: toBig(price), unit };

	// Forward: found row where FromUnit = current unit, ToUnit = CS
	// 1 current_unit = factor × CS → price_per_CS = price_per_current / factor (Big precision)
	const factor = await findConversionFactor(inventoryId, unit, "CS", tenantKey);
	if (factor !== null) {
		return { price: toBig(price).div(factor), unit: "CS" };
	}

	// Reverse: found row where FromUnit = CS, ToUnit = current unit
	// 1 CS = reverseFactor × current_unit → price_per_CS = price_per_current × reverseFactor (Big precision)
	const reverseFactor = await findConversionFactor(inventoryId, "CS", unit, tenantKey);
	if (reverseFactor !== null) {
		return { price: toBig(price).times(reverseFactor), unit: "CS" };
	}

	// No conversion available — keep original
	return { price: toBig(price), unit };
}

// ─── Constants ─────────────────────────────────────────────────────────

const MAX_LIMIT = 10_000;
const DEFAULT_LIMIT = 500;

/**
 * Expire the current active price for a (inventory_id, price_class) pair,
 * then insert a new price row.
 *
 * When `returnInserted` is true, returns the row from the INSERT OUTPUT
 * (needed by createItemPrice). Otherwise returns a boolean indicating
 * whether an existing price was expired (for bulk import counters).
 */
async function expireAndInsertPrice(
	pool: import("mssql").Request,
	inventory_id: string,
	price_class: string,
	validFrom: string,
	price: Big | number,
	unit: string,
	encodedBy: string,
	validTo: string | null,
	returnInserted = false,
): Promise<Record<string, unknown> | undefined | boolean> {
	const selectCols = returnInserted
		? "id, price, unit, price_class, valid_from, valid_to"
		: "id";

	// Expire existing active price for this inventory_id + price_class combo
	const current = await pool
		.request()
		.input("invId", inventory_id)
		.input("priceClass", price_class)
		.query(`
			SELECT ${selectCols}
			FROM SMR_ItemPrice
			WHERE inventory_id = @invId AND price_class = @priceClass AND valid_to IS NULL
		`);

	let expired = false;
	if (current.recordset.length > 0) {
		const oldValidTo = oneSecondBefore(validFrom);
		await pool
			.request()
			.input("id", current.recordset[0].id)
			.input("valid_to", oldValidTo)
			.query("UPDATE SMR_ItemPrice SET valid_to = @valid_to WHERE id = @id");
		expired = true;
	}

	const outputClause = returnInserted
		? "OUTPUT INSERTED.id, INSERTED.inventory_id, INSERTED.price, INSERTED.unit, INSERTED.price_class, INSERTED.valid_from, INSERTED.valid_to, INSERTED.encoded_by"
		: "";

	// Insert new price
	const result = await pool
		.request()
		.input("inventory_id", inventory_id)
		.input("price", bigToNumber(price))
		.input("unit", unit)
		.input("price_class", price_class)
		.input("valid_from", validFrom)
		.input("valid_to", validTo ?? null)
		.input("encoded_by", encodedBy)
		.query(`
			INSERT INTO SMR_ItemPrice (inventory_id, price, unit, price_class, valid_from, valid_to, encoded_by)
			${outputClause}
			VALUES (@inventory_id, @price, @unit, @price_class, @valid_from, @valid_to, @encoded_by)
		`);

	if (returnInserted) return result.recordset[0];
	return expired;
}

// ─── SMR_ItemPrice CRUD (renamed from SMR_ItemCost) ───────────────────

export const createItemPrice = async (item: NewItemPrice, tenantKey = "default"): Promise<ItemPrice> => {
	const validFrom = item.valid_from ?? toMsSqlDatetime(new Date());

	// Normalize unit to CS if possible
	const normalized = await normalizeToCsUnit(item.inventory_id, item.price, item.unit, tenantKey);

	return withTenantDb(tenantKey, async (pool) => {
		const created = await expireAndInsertPrice(
			pool.request(),
			item.inventory_id,
			item.price_class,
			validFrom,
			normalized.price,
			normalized.unit,
			item.encoded_by,
			item.valid_to ?? null,
			true, // returnInserted — need OUTPUT for the return value
		);
		if (!created) throw new Error("Failed to create ItemPrice");
		return {
			...trimStrings(created as Record<string, unknown>),
			price: toBig((created as Record<string, unknown>).price),
		} as unknown as ItemPrice;
	});
};

export const getItemPriceById = async (
	id: number,
	tenantKey = "default",
): Promise<ItemPrice | undefined> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("id", id)
			.query(
				"SELECT id, inventory_id, price, unit, price_class, valid_from, valid_to, encoded_by FROM SMR_ItemPrice WHERE id = @id",
			),
	);
	const raw = result.recordset[0] as Record<string, unknown> | undefined;
	if (!raw) return undefined;
	return {
		...trimStrings(raw),
		price: toBig(raw.price),
	} as unknown as ItemPrice;
};

const getItemPricesByInventoryId = async (
	inventoryId: string,
	tenantKey = "default",
): Promise<ItemPrice[]> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("inventory_id", inventoryId)
			.query(`
				SELECT id, inventory_id, price, unit, price_class, valid_from, valid_to, encoded_by
				FROM SMR_ItemPrice
				WHERE inventory_id = @inventory_id
				ORDER BY valid_from DESC
			`),
	);
	const raw = result.recordset as Record<string, unknown>[];
	return raw.map((r) => ({
		...trimStrings(r),
		price: toBig(r.price),
	})) as unknown as ItemPrice[];
};

const updateItemPrice = async (
	id: number,
	updates: ItemPriceUpdate,
	tenantKey = "default",
): Promise<ItemPrice> => {
	const setClauses: string[] = [];
	if (updates.price !== undefined) setClauses.push("price = @price");
	if (updates.unit !== undefined) setClauses.push("unit = @unit");
	if (updates.price_class !== undefined) setClauses.push("price_class = @price_class");
	if (updates.valid_to !== undefined) setClauses.push("valid_to = @valid_to");
	if (updates.encoded_by !== undefined) setClauses.push("encoded_by = @encoded_by");

	if (setClauses.length === 0) {
		const existing = await getItemPriceById(id, tenantKey);
		if (!existing) throw new NotFoundError(`ItemPrice ${id} not found`);
		return existing;
	}

	return withTenantDb(tenantKey, async (pool) => {
		const req = pool.request().input("id", id);
		if (updates.price !== undefined) req.input("price", bigToNumber(toBig(updates.price)));
		if (updates.unit !== undefined) req.input("unit", updates.unit);
		if (updates.price_class !== undefined) req.input("price_class", updates.price_class);
		if (updates.valid_to !== undefined) req.input("valid_to", updates.valid_to);
		if (updates.encoded_by !== undefined) req.input("encoded_by", updates.encoded_by);

		const result = await req.query(`
			UPDATE SMR_ItemPrice
			SET ${setClauses.join(", ")}
			OUTPUT INSERTED.id, INSERTED.inventory_id, INSERTED.price, INSERTED.unit, INSERTED.price_class, INSERTED.valid_from, INSERTED.valid_to, INSERTED.encoded_by
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
	});
};

export const deleteItemPrice = async (id: number, tenantKey = "default"): Promise<void> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("id", id)
			.query("DELETE FROM SMR_ItemPrice OUTPUT DELETED.id WHERE id = @id"),
	);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`ItemPrice ${id} not found`);
	}
};

/**
 * Set valid_to on an existing ItemPrice (used when replacing with a newer entry).
 * This expires the old price record 1 second before the new price's valid_from.
 */
export const expireItemPrice = async (id: number, validTo: string, tenantKey = "default"): Promise<void> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("id", id)
			.input("valid_to", validTo)
			.query("UPDATE SMR_ItemPrice SET valid_to = @valid_to WHERE id = @id"),
	);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`ItemPrice ${id} not found`);
	}
};

// ─── SMR_PriceClass CRUD (simplified lookup) ──────────────────────────

export const createPriceClass = async (
	pc: NewPriceClass,
	createdBy: string,
	tenantKey = "default",
): Promise<PriceClass> => {
	return withTenantDb(tenantKey, async (pool) => {
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
			.input("created_by", createdBy)
			.query(`
				INSERT INTO SMR_PriceClass (id, description, created_by)
				OUTPUT INSERTED.id, INSERTED.description, INSERTED.created_by
				VALUES (@id, @description, @created_by)
			`);

		const created = result.recordset[0];
		if (!created) throw new Error("Failed to create PriceClass");
		return trimStrings(created as Record<string, unknown>) as unknown as PriceClass;
	});
};

/** Returns all price classes ordered by id */
export const getAllPriceClasses = async (tenantKey = "default"): Promise<PriceClass[]> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.query(`
				SELECT id, description, created_by
				FROM SMR_PriceClass
				ORDER BY id
			`),
	);
	return trimStrings(result.recordset as Record<string, unknown>[]) as unknown as PriceClass[];
};

/** Legacy alias — returns all price classes */
const getPriceClasses = getAllPriceClasses;

/** Legacy alias — returns all price classes (no distinction between current/history anymore) */
const getCurrentPriceClasses = getAllPriceClasses;

/** Returns the price class for a specific id */
const getPriceClassById = async (
	id: string,
	tenantKey = "default",
): Promise<PriceClass | undefined> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("id", id)
			.query(`
				SELECT id, description, created_by
				FROM SMR_PriceClass
				WHERE id = @id
			`),
	);
	const raw = result.recordset[0] as Record<string, unknown> | undefined;
	if (!raw) return undefined;
	return trimStrings(raw) as unknown as PriceClass;
};

/** Returns just the list of price class IDs */
export const getDistinctPriceClasses = async (tenantKey = "default"): Promise<string[]> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.query(`
				SELECT id
				FROM SMR_PriceClass
				ORDER BY id
			`),
	);
	const rows = result.recordset as Array<{ id: string }>;
	return trimStrings(rows.map((r) => r.id));
};

export const updatePriceClass = async (
	id: string,
	updates: PriceClassUpdate,
	tenantKey = "default",
): Promise<PriceClass> => {
		const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("id", id)
			.input("description", updates.description ?? null)
			.query(`
				UPDATE SMR_PriceClass
				SET description = @description
				OUTPUT INSERTED.id, INSERTED.description, INSERTED.created_by
				WHERE id = @id
			`),
	);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`PriceClass '${id}' not found`);
	}
	return trimStrings(result.recordset[0] as Record<string, unknown>) as unknown as PriceClass;
};

export const deletePriceClass = async (id: string, tenantKey = "default"): Promise<void> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("id", id)
			.query(`
				DELETE FROM SMR_PriceClass
				OUTPUT DELETED.id
				WHERE id = @id
			`),
	);

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
	tenantKey = "default",
): Promise<number | null> {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("InvtId", inventoryId)
			.input("FromUnit", fromUnit)
			.input("ToUnit", toUnit)
			.query(`
				SELECT CnvFact, FromUnit, ToUnit
				FROM INUnit
				WHERE InvtId = @InvtId AND FromUnit = @FromUnit AND ToUnit = @ToUnit
			`),
	);
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
	tenantKey = "default",
): Promise<{ price: Big; unit: string }> {
	if (fromUnit === toUnit) return { price: toBig(price), unit: fromUnit };

	// Forward: found row where FromUnit = source unit
	// 1 source_unit = factor × target_unit
	// price_per_target = price_per_source / factor  (Big precision)
	const factor = await findConversionFactor(inventoryId, fromUnit, toUnit, tenantKey);
	if (factor !== null) {
		return { price: toBig(price).div(factor), unit: toUnit };
	}

	// Reverse: found row where FromUnit = target unit
	// 1 target_unit = reverseFactor × source_unit
	// price_per_target = price_per_source × reverseFactor  (Big precision)
	const reverseFactor = await findConversionFactor(inventoryId, toUnit, fromUnit, tenantKey);
	if (reverseFactor !== null) {
		return { price: toBig(price).times(reverseFactor), unit: toUnit };
	}

	// No conversion found — return original
	return { price: toBig(price), unit: fromUnit };
}

/**
 * Batch-convert an array of prices to their respective target units.
 * Each item specifies its inventory_id, price, from_unit, and to_unit.
 * Items where from_unit === to_unit are returned unchanged.
 */
export const batchConvertPrices = async (
	items: ConvertBatchItem[],
	tenantKey = "default",
): Promise<ConvertBatchResult[]> => {
	const results: ConvertBatchResult[] = [];
	for (const item of items) {
		const converted = await convertPrice(
			item.inventory_id,
			item.price,
			item.from_unit,
			item.to_unit,
			tenantKey,
		);
		results.push({
			inventory_id: item.inventory_id,
			converted_price: bigToNumber(converted.price),
			unit: converted.unit,
			price_class: item.price_class,
		});
	}
	return results;
};

// ─── Main paginated query ─────────────────────────────────────────────

/**
 * Fetch paginated price records.
 *
 * One row per inventory_id. Each row includes an array of current prices
 * (one per price_class) plus full history across all price classes.
 *
 * @param page    Page number (1-based).
 * @param limit   Rows per page.
 * @param search  Optional search across InvtID, Descr.
 * @param reqUnit Optional target unit to convert prices into.
 * @param classID Optional ClassID filter (exact match).
 */
export const getPricesPaginated = async (
	page: number,
	limit: number,
	search?: string,
	reqUnit?: string,
	classID?: string,
	tenantKey = "default",
): Promise<PaginatedResponse<PriceRecord>> => {
	const offset = (page - 1) * limit;

	const conditions: string[] = [];
	const hasSearch = search != null && search.trim().length > 0;
	const hasClassID = classID != null && classID.trim().length > 0;

	if (hasSearch) {
		conditions.push(`(i.InvtID LIKE @search OR i.Descr LIKE @search)`);
	}
	if (hasClassID) {
		conditions.push(`i.ClassID = @classID`);
	}

	const whereClause =
		conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

	return withTenantDb(tenantKey, async (pool) => {
		// ── Count total inventory items ────────────────────────────────
		const countQuery = `
			SELECT COUNT(*) AS _total
			FROM Inventory i
			${whereClause}
		`;
		const countReq = pool.request();
		if (hasSearch) countReq.input("search", `%${search.trim()}%`);
		if (hasClassID) countReq.input("classID", classID.trim());
		const countResult = await countReq.query(countQuery);
		const total = Number(countResult.recordset[0]?._total) || 0;

		// ── Count items without any current price ──────────────────────
		const noPriceConditions: string[] = [];
		if (hasSearch) noPriceConditions.push(`(i.InvtID LIKE @search OR i.Descr LIKE @search)`);
		if (hasClassID) noPriceConditions.push(`i.ClassID = @classID`);
		const noPriceWhere = noPriceConditions.length > 0 ? `AND ${noPriceConditions.join(" AND ")}` : "";

		const noPriceCountQuery = `
			SELECT COUNT(*) AS _cnt
			FROM Inventory i
			WHERE NOT EXISTS (
				SELECT 1 FROM SMR_ItemPrice ip
				WHERE ip.inventory_id = i.InvtID AND ip.valid_to IS NULL
			)
			${noPriceWhere}
		`;
		const noPriceReq = pool.request();
		if (hasSearch) noPriceReq.input("search", `%${search.trim()}%`);
		if (hasClassID) noPriceReq.input("classID", classID.trim());
		const noPriceResult = await noPriceReq.query(noPriceCountQuery);
		const withoutPriceCount = Number(noPriceResult.recordset[0]?._cnt) || 0;

		if (total === 0) {
			return { data: [], total: 0, page, limit, totalPages: 1, withoutPriceCount };
		}

		// ── Fetch paginated inventory items (no price join yet) ────────
		const dataQuery = `
			SELECT * FROM (
				SELECT ROW_NUMBER() OVER (ORDER BY i.InvtID) AS _row_num,
					i.InvtID AS inventory_id,
					i.ClassID AS class_id,
					i.Descr AS description
				FROM Inventory i
				${whereClause}
			) AS _paginated
			WHERE _row_num BETWEEN @_offset + 1 AND @_offset + @_limit
			ORDER BY _row_num
		`;
		const dataReq = pool.request();
		if (hasSearch) dataReq.input("search", `%${search.trim()}%`);
		if (hasClassID) dataReq.input("classID", classID.trim());
		dataReq.input("_offset", offset);
		dataReq.input("_limit", limit);
		const dataResult = await dataReq.query(dataQuery);

		type InvRawRow = {
			inventory_id: string;
			class_id: string | null;
			description: string | null;
		};
		const invRows = trimStrings(dataResult.recordset as InvRawRow[]);
		const invIds = invRows.map((r) => r.inventory_id);

		// ── Batch fetch ALL current prices for these inventory_ids ─────
		type PriceRawRow = {
			id: number;
			inventory_id: string;
			price: number;
			unit: string;
			price_class: string;
			valid_from: string;
			valid_to: string | null;
			encoded_by: string;
		};

		const currentMap = new Map<string, PriceClassEntry[]>();
		const historyMap = new Map<string, PriceHistoryEntry[]>();

		if (invIds.length > 0) {
			const priceReq = pool.request();
			const idParams = invIds.map((id, idx) => {
				const paramName = `_id${idx}`;
				priceReq.input(paramName, id);
				return `@${paramName}`;
			});

			// Current prices (valid_to IS NULL) — one per price_class
			const currentResult = await priceReq.query(`
				SELECT id, inventory_id, price, unit, price_class, valid_from, valid_to, encoded_by
				FROM SMR_ItemPrice
				WHERE inventory_id IN (${idParams.join(", ")}) AND valid_to IS NULL
				ORDER BY inventory_id, price_class
			`);
			const currentRows = trimStrings(currentResult.recordset as PriceRawRow[]);
			for (const r of currentRows) {
				const entry: PriceClassEntry = {
					item_price_id: r.id,
					price: toBig(r.price),
					unit: r.unit,
					price_class: r.price_class,
					valid_from: r.valid_from,
					encoded_by: r.encoded_by,
				};
				const existing = currentMap.get(r.inventory_id) ?? [];
				existing.push(entry);
				currentMap.set(r.inventory_id, existing);
			}

			// All prices (for history)
			const allResult = await priceReq.query(`
				SELECT id, inventory_id, price, unit, price_class, valid_from, valid_to, encoded_by
				FROM SMR_ItemPrice
				WHERE inventory_id IN (${idParams.join(", ")})
				ORDER BY inventory_id, valid_from DESC
			`);
			const allRows = trimStrings(allResult.recordset as PriceRawRow[]);

			const currentKeys = new Set<string>();
			for (const r of currentRows) {
				currentKeys.add(`${r.inventory_id}::${r.price_class}`);
			}

			for (const r of allRows) {
				if (r.valid_to === null && currentKeys.has(`${r.inventory_id}::${r.price_class}`)) {
					continue;
				}
				const entry: PriceHistoryEntry = {
					valid_from: r.valid_from,
					valid_to: r.valid_to,
					price: toBig(r.price),
					unit: r.unit,
					price_class: r.price_class,
					encoded_by: r.encoded_by,
				};
				const existing = historyMap.get(r.inventory_id) ?? [];
				existing.push(entry);
				historyMap.set(r.inventory_id, existing);
			}
		}

		// ── Assemble response ──────────────────────────────────────────
		const data: PriceRecord[] = [];
		for (const inv of invRows) {
			let prices = currentMap.get(inv.inventory_id) ?? [];

			// Unit conversion if requested
			if (reqUnit) {
				prices = await Promise.all(
					prices.map(async (p) => {
						const converted = await convertPrice(inv.inventory_id, p.price, p.unit, reqUnit, tenantKey);
						return { ...p, price: converted.price, unit: converted.unit };
					}),
				);
			}

			data.push({
				inventory_id: inv.inventory_id,
				class_id: inv.class_id,
				description: inv.description,
				prices,
				history: historyMap.get(inv.inventory_id) ?? [],
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
	});
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
	encodedBy: string,
	tenantKey = "default",
): Promise<ImportResult> => {
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
			await withTenantDb(tenantKey, async (pool) => {
				// Check if inventory exists
				const invCheck = await pool
					.request()
					.input("invtId", item.inventory_id)
					.query("SELECT COUNT(*) AS _cnt FROM Inventory WHERE InvtID = @invtId");
				if (Number(invCheck.recordset[0]?._cnt) === 0) {
					errors.push({ row: rowNum, message: `Inventory '${item.inventory_id}' not found` });
					return;
				}

				// Check if price_class exists
				const pcCheck = await pool
					.request()
					.input("priceClass", item.price_class)
					.query("SELECT COUNT(*) AS _cnt FROM SMR_PriceClass WHERE id = @priceClass");
				if (Number(pcCheck.recordset[0]?._cnt) === 0) {
					errors.push({ row: rowNum, message: `Price class '${item.price_class}' not found` });
					return;
				}

				// Default valid_from to current datetime
				const validFrom = item.valid_from ?? toMsSqlDatetime(new Date());

				// Normalize unit to CS if possible
				const normalized = await normalizeToCsUnit(item.inventory_id, item.price, item.unit, tenantKey);

				const hadActive = await expireAndInsertPrice(
					pool.request(),
					item.inventory_id,
					item.price_class,
					validFrom,
					normalized.price,
					normalized.unit,
					encodedBy,
					item.valid_to ?? null,
				);
				if (hadActive) updated++;
				inserted++;
			});
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
export const getDistinctCatalogNbr = async (tenantKey = "default"): Promise<string[]> => {
	return getDistinctPriceClasses(tenantKey);
};

/** @deprecated Use createItemPrice instead */
const createItemCost = createItemPrice;

/** @deprecated Use getItemPriceById instead */
const getItemCostById = getItemPriceById;

/** @deprecated Use getItemPricesByInventoryId instead */
const getItemCostsByInventoryId = getItemPricesByInventoryId;

/** @deprecated Use updateItemPrice instead */
const updateItemCost = updateItemPrice;

/** @deprecated Use deleteItemPrice instead */
const deleteItemCost = deleteItemPrice;

/** @deprecated Use expireItemPrice instead */
const expireItemCost = expireItemPrice;

/** @deprecated Use importItemPrices instead */
const importItemCosts = importItemPrices;

/** @deprecated Use getPriceClassById instead */
const getPriceClassHistory = getPriceClassById;
