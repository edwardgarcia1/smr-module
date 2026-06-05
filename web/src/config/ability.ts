import { AbilityBuilder, PureAbility } from '@casl/ability';
import { ALL_SUBJECTS, SUBJECT_ALIASES } from './permissions';

export type AppAbility = PureAbility;

/**
 * Re-exported from permissions for backward compatibility.
 * @deprecated Import ALL_SUBJECTS directly from permissions.
 */
export const ALL_MODULES = ALL_SUBJECTS;

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
