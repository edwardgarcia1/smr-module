// ─── Period Label Helpers ──────────────────────────────────────────────
// Shared between purchasing and bundling modules.

export const MONTH_NAMES = [
	"Jan", "Feb", "Mar", "Apr", "May", "Jun",
	"Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function monthLabel(year: number, month: number): string {
	return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function weekLabel(year: number, month: number, week: number): string {
	return `W${week} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** Numeric sort key for period labels — ensures chronological order */
export function periodSortValue(key: string): number {
	const monthIdx: { [k: string]: number } = {
		Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
		Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
	};
	// "W1 Jan 2026"
	const wm = key.match(/^W(\d+)\s+(\w+)\s+(\d+)$/);
	if (wm && wm[2] && wm[3])
		return Number(wm[3]) * 60 + (monthIdx[wm[2]] ?? 0) * 5 + Number(wm[1]);
	// "Jan 2026"
	const mm = key.match(/^(\w+)\s+(\d+)$/);
	if (mm && mm[1] && mm[2]) return Number(mm[2]) * 12 + (monthIdx[mm[1]] ?? 0);
	return 0;
}

/**
 * Generate all period keys between the date ranges so we can
 * initialise demand maps with zeros (even for periods with no sales).
 */
export function generatePeriodKeys(
	ranges: { start: string; end: string }[],
	freq: "weekly" | "monthly",
): string[] {
	const set = new Set<string>();
	for (const r of ranges) {
		const start = new Date(r.start);
		const end = new Date(r.end);
		// Start from the first day of the start month so we don't miss
		// week-5 periods at the beginning (e.g. W5 Jan when start is Jan 29).
		// This ensures every month fully intersecting the date range
		// contributes all possible period labels.
		const cur = new Date(start.getFullYear(), start.getMonth(), 1);
		while (cur <= end) {
			const y = cur.getFullYear();
			const m = cur.getMonth() + 1;
			if (freq === "monthly") {
				set.add(monthLabel(y, m));
			} else {
				// Generate all 5 week labels for this month so SQL GROUP BY
				// results for W1–W5 always have a matching column.
				for (let w = 1; w <= 5; w++) {
					set.add(weekLabel(y, m, w));
				}
			}
			cur.setMonth(cur.getMonth() + 1); // advance 1 calendar month
		}
	}
	return [...set].sort((a, b) => periodSortValue(a) - periodSortValue(b));
}

/** Group a (year, month, day) triple into the period key */
export function periodKeyFromParts(
	y: number,
	m: number,
	d: number,
	freq: "weekly" | "monthly",
): string {
	if (freq === "monthly") return monthLabel(y, m);
	const w = Math.min(Math.ceil(d / 7), 5);
	return weekLabel(y, m, w);
}
