// ─── INUnit Conversion Cache ───────────────────────────────────────────
// Shared between purchasing and bundling modules.

import { withDb } from "../config/db";
import { trimStrings } from "./trimStrings";

interface UnitConvRow {
	InvtId: string;
	FromUnit: string;
	ToUnit: string;
	CnvFact: number;
}

/**
 * Fetch ALL conversion rows for the given inventory IDs in a single query.
 * Returns a map keyed by "InvtId|FromUnit|ToUnit" → CnvFact.
 */
export async function buildConversionCache(
	invtIDs: string[],
): Promise<Map<string, number>> {
	const cache = new Map<string, number>();
	if (invtIDs.length === 0) return cache;

	const result = await withDb(async (pool) => {
		const placeholders = invtIDs.map((_, i) => `@invt${i}`);
		const sql = `
			SELECT InvtId, FromUnit, ToUnit, CnvFact
			FROM INUnit
			WHERE InvtId IN (${placeholders.join(", ")})
		`;
		const req = pool.request();
		for (const [i, id] of invtIDs.entries()) {
			req.input(`invt${i}`, id);
		}
		return req.query(sql);
	});

	const rows = trimStrings(result.recordset) as UnitConvRow[];
	for (const row of rows) {
		cache.set(`${row.InvtId}|${row.FromUnit}|${row.ToUnit}`, Number(row.CnvFact));
	}
	return cache;
}

/**
 * Look up conversion factor from cache.
 * INUnit stores: 1 FromUnit = CnvFact × ToUnit.
 */
export function getCnvFactor(
	cache: Map<string, number>,
	invtID: string,
	fromUnit: string,
	toUnit: string,
): number | null {
	return cache.get(`${invtID}|${fromUnit}|${toUnit}`) ?? null;
}

/**
 * Check whether a conversion exists between two units for a given item.
 */
export function canConvert(
	cache: Map<string, number>,
	invtID: string,
	fromUnit: string,
	toUnit: string,
): boolean {
	const fwd = getCnvFactor(cache, invtID, fromUnit, toUnit);
	if (fwd !== null && fwd > 0) return true;
	const rev = getCnvFactor(cache, invtID, toUnit, fromUnit);
	if (rev !== null && rev > 0) return true;
	return false;
}

/**
 * Normalise qty using cached INUnit data.
 * Returns original qty when no conversion is needed or available.
 */
export function normaliseQtyCached(
	cache: Map<string, number>,
	invtID: string,
	qty: number,
	fromUnit: string,
	toUnit: string,
): number {
	if (
		!fromUnit ||
		!toUnit ||
		fromUnit.toUpperCase() === toUnit.toUpperCase()
	) {
		return qty;
	}
	// INUnit: 1 FromUnit = CnvFact × ToUnit
	// For QUANTITY conversion (not cost/rate):
	//   Forward: fromUnit→toUnit: qty_toTarget = qty × CnvFact
	//   Reverse: lookup (toUnit→fromUnit): qty_toTarget = qty / revCnvFact
	const fwd = getCnvFactor(cache, invtID, fromUnit, toUnit);
	if (fwd !== null && fwd > 0) return qty * fwd;
	const rev = getCnvFactor(cache, invtID, toUnit, fromUnit);
	if (rev !== null && rev > 0) return qty / rev;
	return qty;
}
