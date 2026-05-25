// ── Refactored tables ─────────────────────────────────────────────────
// SMR_ItemPrice: price per inventory item with unit, price_class, and validity dates
// SMR_PriceClass: simple lookup table of valid price classes
// Joins: Inventory (InvtID), INUnit (InvtId), SMR_ItemPrice (inventory_id, price_class)
//
// All price fields typed as `Big` for precise decimal arithmetic.
// Convert at boundaries only:
//   DB  → Big: toBig(rawNumber)
//   Big → JSON: bigToNumber(bigVal)  (via toPlainJson)

import Big from "big.js";
import type { Inventory } from "../item/item.schema";

// ─── Boundary helpers ────────────────────────────────────────────────

/** Coerce a raw DB number or string into a `Big`. Null → Big(0). */
export function toBig(val: unknown): Big {
	if (val == null) return new Big(0);
	if (val instanceof Big) return val;
	if (typeof val === "number") return new Big(val);
	if (typeof val === "string") return new Big(val);
	return new Big(0);
}

/** Round a Big to `dp` decimal places and return a plain number for JSON. */
export function bigToNumber(val: Big, dp = 4): number {
	return Number(val.toFixed(dp));
}

/**
 * Recursively walk a value tree and convert every `Big` instance to
 * a plain number (4dp).  Use at the route boundary so JSON.stringify
 * produces numbers instead of `Big.toJSON()` strings.
 */
export function toPlainJson<T>(val: T): T {
	if (val instanceof Big) return bigToNumber(val) as unknown as T;
	if (Array.isArray(val)) return val.map(toPlainJson) as unknown as T;
	if (val !== null && typeof val === "object" && !(val instanceof Date)) {
		const result: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
			result[k] = toPlainJson(v);
		}
		return result as T;
	}
	return val;
}

// ─── SMR_ItemPrice (renamed from SMR_ItemCost) ────────────────────────

export interface ItemPrice {
	id: number;
	inventory_id: string;
	price: Big;
	unit: string;
	price_class: string;
	valid_from: string; // DATETIME
	valid_to: string | null; // DATETIME, NULL = current
}

/** `price` accepts `Big | number` so API body numbers work as-is. */
export type NewItemPrice = {
	inventory_id: string;
	price: Big | number;
	unit: string;
	price_class: string;
	valid_from?: string; // defaults to current DATETIME
	valid_to?: string | null;
};

export type ItemPriceUpdate = Partial<Pick<ItemPrice, "price" | "unit" | "price_class" | "valid_to">>;

// ─── SMR_PriceClass (simplified lookup) ───────────────────────────────

export interface PriceClass {
	id: string;       // the price class name (NVARCHAR PK)
	description: string | null;
}

export type NewPriceClass = {
	id: string;
	description?: string | null;
};

export type PriceClassUpdate = {
	description?: string | null;
};

// ─── History entry ────────────────────────────────────────────────────

export interface PriceHistoryEntry {
	valid_from: string;
	valid_to: string | null;
	price: Big;
	unit: string;
	price_class: string;
}

// ─── Current price entry (one per price_class) ─────────────────────────

export interface PriceClassEntry {
	item_price_id: number;
	price: Big;
	unit: string;
	price_class: string;
}

// ─── Price record — response shape (one per inventory_id) ──────────────

export interface PriceRecord {
	inventory_id: string;
	class_id: string | null;
	description: string | null;
	prices: PriceClassEntry[];    // current prices, one per price_class
	history: PriceHistoryEntry[]; // all historical entries across all price classes
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	withoutPriceCount: number; // inventory items with no current price
}

/** Query params accepted by GET /price */
export interface PriceQuery {
	page: number;
	limit: number;
	search?: string;
	unit?: string;
}

/** Row from Excel import — must have inventory_id, price, unit, price_class */
export interface BulkImportItem {
	inventory_id: string;
	price: Big | number;
	unit: string;
	price_class: string;
	valid_from?: string; // defaults to current DATETIME
	valid_to?: string | null;
}

/** Result of a bulk import */
export interface ImportResult {
	processed: number;
	inserted: number;
	updated: number;
	errors: Array<{ row: number; message: string }>;
}

// ─── Backward-compat aliases ──────────────────────────────────────────

export type { Inventory };

/** @deprecated Use ItemPrice instead */
export type ItemCost = ItemPrice;

/** @deprecated Use NewItemPrice instead */
export type NewItemCost = NewItemPrice;

// ─── DDL ──────────────────────────────────────────────────────────────

/** MSSQL 2008 compatible DDL for SMR_ItemPrice table (renamed from SMR_ItemCost) */
export const CREATE_ITEMPRICE_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SMR_ItemPrice' AND xtype='U')
BEGIN
  CREATE TABLE SMR_ItemPrice (
    id BIGINT IDENTITY(1,1) NOT NULL,
    inventory_id NVARCHAR(30) NOT NULL,
    price NUMERIC(18, 4) NOT NULL,
    unit NVARCHAR(10) NOT NULL,
    price_class NVARCHAR(30) NOT NULL,
    valid_from DATETIME NOT NULL,
    valid_to DATETIME NULL,
    CONSTRAINT PK_SMR_ItemPrice PRIMARY KEY (id)
  );

  CREATE NONCLUSTERED INDEX IX_SMR_ItemPrice_inventory_id ON SMR_ItemPrice (inventory_id);
  CREATE NONCLUSTERED INDEX IX_SMR_ItemPrice_price_class ON SMR_ItemPrice (price_class);
  CREATE NONCLUSTERED INDEX IX_SMR_ItemPrice_valid_from ON SMR_ItemPrice (valid_from);
END
`;

/** @deprecated Use CREATE_ITEMPRICE_TABLE_SQL instead */
export const CREATE_ITEMCOST_TABLE_SQL = CREATE_ITEMPRICE_TABLE_SQL;

/** MSSQL 2008 compatible DDL for SMR_PriceClass table (simplified lookup) */
export const CREATE_PRICECLASS_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SMR_PriceClass' AND xtype='U')
BEGIN
  CREATE TABLE SMR_PriceClass (
    id NVARCHAR(30) NOT NULL,
    description NVARCHAR(150) NULL,
    CONSTRAINT PK_SMR_PriceClass PRIMARY KEY (id)
  );
END
`;
