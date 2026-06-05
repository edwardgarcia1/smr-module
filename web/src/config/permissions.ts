/**
 * Canonical list of all permission subjects in the system.
 * Both PascalCase (canonical) and kebab-case user-facing names are listed so
 * that permissions stored under either form are recognised.  The alias builder
 * (run at import time) bridges them automatically.
 *
 * "Dashboard" is included for sidebar rendering but is accessible to all
 * authenticated users — no permission check is performed for it on the API.
 */
export const ALL_SUBJECTS = [
	"Dashboard",
	"Requirements",
	"purchasing-requirements",
	"Prices",
	"prices",
	"MinStock",
	"PurchaseOrders",
	"purchase-orders",
	"InventoryItems",
	"inventory-items",
	"Principals",
	"Users",
	"Settings",
] as const;

export type Subject = (typeof ALL_SUBJECTS)[number];

export type Actions = "manage" | "create" | "read" | "update" | "delete";

/** Mapping: PascalCase subject ↔ its kebab-case alias (and vice-versa). */
export const SUBJECT_ALIASES: Record<string, string[]> = {};

function buildAliases(): void {
	const ALL = [...ALL_SUBJECTS];
	for (let i = 0; i < ALL.length; i++) {
		const a = ALL[i]!;
		for (let j = i; j < ALL.length; j++) {
			const b = ALL[j]!;
			if (a === b) continue;
			// Two subjects are aliases if they match when lower-cased and
			// all punctuation is removed (e.g. "inventory-items" ↔ "InventoryItems")
			const normA = a.toLowerCase().replace(/[^a-z0-9]/g, "");
			const normB = b.toLowerCase().replace(/[^a-z0-9]/g, "");
			if (normA === normB) {
				(SUBJECT_ALIASES[a] ??= []).push(b);
				(SUBJECT_ALIASES[b] ??= []).push(a);
			}
		}
	}
}

buildAliases();

// Manual aliases for subjects with different normalized forms that
// should be treated as equivalent.
(function addManualAliases(): void {
	const all = ALL_SUBJECTS as readonly string[];
	const pairs: [string, string][] = [
		["Requirements", "purchasing-requirements"],
	];
	for (const [a, b] of pairs) {
		if (all.includes(a) && all.includes(b)) {
			(SUBJECT_ALIASES[a] ??= []).push(b);
			(SUBJECT_ALIASES[b] ??= []).push(a);
		}
	}
})();
