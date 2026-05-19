// ── New tables for refactored price module ────────────────────────────
// SMR_ItemCost: cost per inventory item with unit and validity dates
// SMR_PriceClass: price class with discount percentage and validity dates
// Joins: Inventory (InvtID), INUnit (InvtId), SMR_ItemCost (inventory_id), SMR_PriceClass (price_class)
//
// All cost / pct_discount fields typed as `Big` for precise decimal arithmetic.
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

// ─── SMR_ItemCost ─────────────────────────────────────────────────────

export interface ItemCost {
	id: number;
	inventory_id: string;
	cost: Big;
	unit: string;
	valid_from: string; // DATETIME
	valid_to: string | null; // DATETIME, NULL = current
}

/** `cost` accepts `Big | number` so API body numbers work as-is. */
export type NewItemCost = {
	inventory_id: string;
	cost: Big | number;
	unit: string;
	valid_from?: string; // defaults to current DATETIME
	valid_to?: string | null;
};

export type ItemCostUpdate = Partial<Pick<ItemCost, "cost" | "unit" | "valid_to">>;

// ─── SMR_PriceClass ───────────────────────────────────────────────────

export interface PriceClass {
	id: number;
	price_class: string;
	pct_discount: Big;
	valid_from: string; // DATETIME
	valid_to: string | null; // DATETIME, NULL = current
}

export type NewPriceClass = {
	price_class: string;
	pct_discount: Big | number;
	valid_from: string;
	valid_to?: string | null;
};

export type PriceClassUpdate = {
	pct_discount?: Big | number;
	valid_to?: string | null;
};

// ─── History entry ────────────────────────────────────────────────────

export interface PriceHistoryEntry {
	valid_from: string;
	valid_to: string | null;
	cost: Big;
	unit: string;
}

// ─── Price record — response shape per the plan ──────────────────────

export interface PriceRecord {
	item_cost_id: number | null; // SMR_ItemCost.id (for editing)
	inventory_id: string;
	class_id: string | null;
	description: string | null;
	cost: Big | null;
	unit: string | null;
	history: PriceHistoryEntry[];
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	withoutCostCount: number; // inventory items with no current cost
}

/** Query params accepted by GET /price */
export interface PriceQuery {
	page: number;
	limit: number;
	search?: string;
	unit?: string;
}

/** Row from Excel import — must have inventory_id, cost, unit */
export interface BulkImportItem {
	inventory_id: string;
	cost: Big | number;
	unit: string;
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

// ─── Backward-compat aliases (for lookups.service.ts) ─────────────────

export type { Inventory };

// ─── DDL ──────────────────────────────────────────────────────────────

/** MSSQL 2008 compatible DDL for SMR_ItemCost table */
export const CREATE_ITEMCOST_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SMR_ItemCost' AND xtype='U')
BEGIN
  CREATE TABLE SMR_ItemCost (
    id BIGINT IDENTITY(1,1) NOT NULL,
    inventory_id NVARCHAR(30) NOT NULL,
    cost NUMERIC(18, 4) NOT NULL,
    unit NVARCHAR(10) NOT NULL,
    valid_from DATETIME NOT NULL,
    valid_to DATETIME NULL,
    CONSTRAINT PK_SMR_ItemCost PRIMARY KEY (id)
  );
END
`;

/** MSSQL 2008 compatible DDL for SMR_PriceClass table */
export const CREATE_PRICECLASS_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SMR_PriceClass' AND xtype='U')
BEGIN
  CREATE TABLE SMR_PriceClass (
    id BIGINT IDENTITY(1,1) NOT NULL,
    price_class NVARCHAR(30) NOT NULL,
    pct_discount NUMERIC(18, 4) NOT NULL,
    valid_from DATETIME NOT NULL,
    valid_to DATETIME NULL,
    CONSTRAINT PK_SMR_PriceClass PRIMARY KEY (id)
  );
END
`;
