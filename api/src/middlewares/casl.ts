import { Elysia, type Context } from "elysia";
import { createMongoAbility, AbilityBuilder, type MongoAbility, type InferSubjects } from "@casl/ability";
import {
	SUBJECT_ALIASES,
	type Subject,
	type Actions,
} from "../../../shared/permissions";
import { type AuthUser } from "./auth";
import { ForbiddenError } from "./error";
import { getPermissionsByUserId } from "../modules/users/permission.service";

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
