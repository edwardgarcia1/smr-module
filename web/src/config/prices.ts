// ─── Price page types, constants, and pure utilities ──────────────────

import Big from "big.js";

// ── Types matching refactored price.schema.ts ─────────────────────────

export interface PriceHistoryEntry {
	valid_from: string;
	valid_to: string | null;
	price: number;
	unit: string;
	price_class: string;
	encoded_by: string;
}

export interface PriceClassEntry {
	item_price_id: number;
	price: number;
	unit: string;
	price_class: string;
	encoded_by: string;
	valid_from: string | null;
	valid_to: string | null;
}

export interface PriceRecord {
	inventory_id: string;
	class_id: string | null;
	description: string | null;
	prices: PriceClassEntry[];
	history: PriceHistoryEntry[];
}

export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	withoutPriceCount: number;
}

export interface ImportRow {
	inventory_id: string;
	price: number;
	unit: string;
	price_class: string;
	valid_from?: string;
	valid_to?: string | null;
}

export interface Principal {
	ClassID: string;
	Descr: string;
	User5: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

export function fmtNum(val: Big | number | null | undefined): string {
	if (val === null || val === undefined) return "—";
	const n = val instanceof Big ? Number(val.toFixed(4)) : val;
	return n.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	});
}

export function fmtDate(val: string | null | undefined): string {
	if (!val) return "Current";
	const d = new Date(val);
	return d.toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export const UNIT_OPTIONS = [
	"BAGS",
	"CAN",
	"CS",
	"IB",
	"PCK",
	"PCS",
	"PET",
	"SACKS",
	"SET",
	"SW",
	"TETRA",
];
