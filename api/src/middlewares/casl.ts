import { Elysia, type Context } from "elysia";
import { createMongoAbility, AbilityBuilder, type MongoAbility, type InferSubjects } from "@casl/ability";
import { type AuthUser } from "./auth";
import { ForbiddenError } from "./error";

export type Subject = "User" | "all";
export type Actions = "manage" | "create" | "read" | "update" | "delete";

export type AppAbility = MongoAbility<[Actions, InferSubjects<Subject>]>;

export const caslMiddleware = (app: Elysia) =>
    app.derive(async (context: Context) => {
        // Access user from context. authGuard must run before this middleware.
        const user = (context as any).user as AuthUser | null;
        
        const { build, can } = new AbilityBuilder<AppAbility>(createMongoAbility);

        if (user) {
            // Original logic: only superadmin can list/manipulate users
            if (user.role === "superadmin") {
                can("manage", "User");
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
