import { Elysia, type Context } from "elysia";
import { createMongoAbility, AbilityBuilder, type MongoAbility, type InferSubjects } from "@casl/ability";
import { type AuthUser } from "./auth";
import { ForbiddenError } from "./error";
import { getPermissionsByUserId } from "../modules/users/permission.service";

/** Mapping: PascalCase subject → its kebab-case alias (and vice-versa).
 *  Every subject from ALL_SUBJECTS appears here.  The ability builders use
 *  this map so that a DB permission row stored in either format grants
 *  access via BOTH spellings. */
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

/** Subjects grouped by sidebar tab modules.
 *  "Dashboard" omitted — accessible to all authenticated users (no permission check).
 *  "Users" kept — only seeded for superadmin; not shown in the UI dialog.
 *
 *  Both PascalCase (canonical) and kebab-case user-facing names are listed
 *  here so that permissions stored under either form are recognised.
 *  The ability builders use SUBJECT_ALIASES to bridge them automatically. */
export const ALL_SUBJECTS = [
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
	"Suppliers",
	"suppliers",
	"Users",
	"Settings",
] as const;

buildAliases();

// Manual aliases for subjects with different normalized forms that
// should be treated as equivalent (e.g. "Principals" ↔ "suppliers").
(function addManualAliases(): void {
	const all = ALL_SUBJECTS as readonly string[];
	const pairs: [string, string][] = [
		["Principals", "suppliers"],
		["Requirements", "purchasing-requirements"],
	];
	for (const [a, b] of pairs) {
		if (all.includes(a) && all.includes(b)) {
			(SUBJECT_ALIASES[a] ??= []).push(b);
			(SUBJECT_ALIASES[b] ??= []).push(a);
		}
	}
})();

export type Subject = (typeof ALL_SUBJECTS)[number];

export type Actions = "manage" | "create" | "read" | "update" | "delete";

export type AppAbility = MongoAbility<[Actions, InferSubjects<Subject>]>;

export const caslMiddleware = (app: Elysia) =>
	app.derive(async (context: Context) => {
		// Access user from context. authGuard must run before this middleware.
		const user = (context as any).user as AuthUser | null;

		const { build, can } = new AbilityBuilder<AppAbility>(createMongoAbility);

		if (user) {
			// Load permissions from DB dynamically
			const permissions = await getPermissionsByUserId(user.id, user.tenant);
			for (const perm of permissions) {
				// Apply the rule for the stored subject AND all its aliases,
				// so a permission stored under either PascalCase or kebab-case
				// is recognised by checks of either spelling.
				const subjects = [perm.subject, ...(SUBJECT_ALIASES[perm.subject] ?? [])];
				for (const subject of subjects) {
					if (perm.action === "manage") {
						can("manage", subject as Subject);
					} else {
						can(perm.action as Actions, subject as Subject);
					}
				}
			}
		}

		const ability = build();

		return { ability };
	});

export const checkPermission = (ability: AppAbility, action: Actions, subject: Subject) => {
	if (!ability.can(action, subject)) {
		throw new ForbiddenError("Insufficient permissions");
	}
	return true;
};
