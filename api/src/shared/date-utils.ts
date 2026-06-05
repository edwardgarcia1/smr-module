/**
 * Shared date utility types and parsers for route modules.
 *
 * Consolidates DateRange type and parseDateRange to eliminate
 * duplication across bundling.routes.ts, purchasing.routes.ts,
 * and sales-service.ts.
 */

export interface DateRange {
	start: string; // YYYY-MM-DD
	end: string;   // YYYY-MM-DD
}

/**
 * Parse a single ?dateRange=start,end query param into a DateRange.
 */
export function parseDateRange(raw: unknown): DateRange | null {
	if (typeof raw !== "string") return null;
	const parts = raw.split(",");
	if (parts.length !== 2) return null;
	const start = (parts[0] ?? "").trim();
	const end = (parts[1] ?? "").trim();
	if (!start || !end) return null;

	const dateRe = /^\d{4}-\d{2}-\d{2}$/;
	if (!dateRe.test(start) || !dateRe.test(end)) return null;

	return { start, end } as DateRange;
}
