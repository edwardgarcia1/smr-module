import { Elysia, type Context } from "elysia";
import { createMongoAbility, AbilityBuilder, type MongoAbility, type InferSubjects } from "@casl/ability";
import { type AuthUser } from "./auth";
import { ForbiddenError } from "./error";
import { getPermissionsByUserId } from "../modules/users/permission.service";

/** Subjects grouped by sidebar tab modules.
 *  "Dashboard" omitted — accessible to all authenticated users (no permission check).
 *  "Users" kept — only seeded for superadmin; not shown in the UI dialog. */
export const ALL_SUBJECTS = [
	"Requirements",
	"Prices",
	"MinStock",
	"PurchaseOrders",
	"InventoryItems",
	"Principals",
	"Users",
	"Settings",
] as const;

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
				if (perm.action === "manage") {
					can("manage", perm.subject as Subject);
				} else {
					can(perm.action as Actions, perm.subject as Subject);
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
