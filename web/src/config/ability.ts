import { AbilityBuilder, PureAbility } from '@casl/ability';

export type AppAbility = PureAbility;

/**
 * Mapping: PascalCase subject ↔ its kebab-case alias.
 * Built automatically from ALL_MODULES so both spellings grant access.
 * Must be kept in sync with api/src/middlewares/casl.ts.
 */
export const SUBJECT_ALIASES: Record<string, string[]> = {};

function buildAliases(): void {
	const ALL = [...ALL_MODULES];
	for (let i = 0; i < ALL.length; i++) {
		const a = ALL[i]!;
		for (let j = i; j < ALL.length; j++) {
			const b = ALL[j]!;
			if (a === b) continue;
			const normA = a.toLowerCase().replace(/[^a-z0-9]/g, '');
			const normB = b.toLowerCase().replace(/[^a-z0-9]/g, '');
			if (normA === normB) {
				(SUBJECT_ALIASES[a] ??= []).push(b);
				(SUBJECT_ALIASES[b] ??= []).push(a);
			}
		}
	}
}

/**
 * Module subjects matching the backend sidebar-tab grouping.
 * Both PascalCase (canonical) and kebab-case user-facing names are listed
 * so that permissions stored under either form are recognised.
 * Must be kept in sync with api/src/middlewares/casl.ts.
 */
export const ALL_MODULES = [
	'Dashboard',
	'Requirements',
	'purchasing-requirements',
	'Prices',
	'prices',
	'MinStock',
	'PurchaseOrders',
	'purchase-orders',
	'InventoryItems',
	'inventory-items',
	'Principals',
	'Suppliers',
	'suppliers',
	'Users',
	'Settings',
] as const;

buildAliases();

// Manual aliases for subjects with different normalized forms that
// should be treated as equivalent (e.g. "Principals" ↔ "suppliers").
(function addManualAliases(): void {
	const all = ALL_MODULES as readonly string[];
	const pairs: [string, string][] = [
		['Principals', 'suppliers'],
		['Requirements', 'purchasing-requirements'],
	];
	for (const [a, b] of pairs) {
		if (all.includes(a) && all.includes(b)) {
			(SUBJECT_ALIASES[a] ??= []).push(b);
			(SUBJECT_ALIASES[b] ??= []).push(a);
		}
	}
})();

/** Shape of a permission row returned by GET /users/:id/permissions */
export interface PermissionRow {
	id: number;
	userId: number;
	subject: string;
	action: string;
}

/** Build CASL ability from a raw permissions array (DB-driven). */
export const buildAbilityFromPermissions = (
	permissions: PermissionRow[],
): AppAbility => {
	const { can, build } = new AbilityBuilder<PureAbility>(PureAbility);

	for (const perm of permissions) {
		// Apply the rule for the stored subject AND all its aliases,
		// so a permission stored under either PascalCase or kebab-case
		// is recognised by checks of either spelling.
		const subjects = [perm.subject, ...(SUBJECT_ALIASES[perm.subject] ?? [])];
		for (const subject of subjects) {
			if (perm.action === 'manage') {
				can('manage', subject);
			} else {
				can(perm.action, subject);
			}
		}
	}

	return build();
};

/** Fallback: empty ability that denies everything. Used when permissions can't be fetched. */
export const buildEmptyAbility = (): AppAbility => {
	const { build } = new AbilityBuilder<PureAbility>(PureAbility);
	return build();
};
