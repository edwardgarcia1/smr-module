import { AbilityBuilder, PureAbility } from '@casl/ability';

export type AppAbility = PureAbility;

/**
 * Module subjects matching the backend sidebar-tab grouping.
 * These must be kept in sync with api/src/middlewares/casl.ts.
 */
export const ALL_MODULES = [
	'Dashboard',
	'Requirements',
	'Prices',
	'MinStock',
	'PurchaseOrders',
	'InventoryItems',
	'Principals',
	'Users',
	'Settings',
] as const;

export type Subject = (typeof ALL_MODULES)[number];

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
		if (perm.action === 'manage') {
			can('manage', perm.subject);
		} else {
			can(perm.action, perm.subject);
		}
	}

	return build();
};

/** Fallback: empty ability that denies everything. Used when permissions can't be fetched. */
export const buildEmptyAbility = (): AppAbility => {
	const { build } = new AbilityBuilder<PureAbility>(PureAbility);
	return build();
};
