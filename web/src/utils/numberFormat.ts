/**
 * Reusable number formatting utilities.
 * Eliminates repetitive toLocaleString() calls throughout RequirementsPage.
 */

type Formatter = (value?: number | null) => string;

function createFormatter(minFraction: number, maxFraction: number, fallback = "—"): Formatter {
	return (value?: number | null) =>
		value != null
			? value.toLocaleString(undefined, {
					minimumFractionDigits: minFraction,
					maximumFractionDigits: maxFraction,
				})
			: fallback;
}

/** 2 decimal places, "—" for null/undefined */
export const fmt2 = createFormatter(2, 2);

/** 4 decimal places, "—" for null/undefined */
const fmt4 = createFormatter(4, 4);

/** 0 decimal places, "" for null/undefined */
export const fmt0: Formatter = (value?: number | null) =>
	value != null ? value.toLocaleString() : "";

/** Fixed 2 decimal places as string (no locale grouping), "" for null */
export const fmtFixed2: Formatter = (value?: number | null) =>
	value != null ? value.toFixed(2) : "";

/** Date string formatter: parses ISO date → locale string */
export function formatDate(value?: string | null): string {
	if (!value) return "—";
	try {
		const d = new Date(value);
		return d.toLocaleString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return value;
	}
}
