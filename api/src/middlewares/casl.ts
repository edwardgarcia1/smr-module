import { Elysia, type Context } from "elysia";
import { createMongoAbility, AbilityBuilder, type MongoAbility, type InferSubjects } from "@casl/ability";
import { type AuthUser } from "./auth";
import { ForbiddenError } from "./error";

export type Subject = "User" | "Site" | "ProductClass" | "Vendor" | "Inventory" | "Component" | "SlsPrc" | "SlsPrcDet" | "Sales" | "ItemCost" | "ItemPrice" | "PriceClass" | "Bundling" | "Dashboard" | "all";
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
				can("manage", "Site");
				can("manage", "ProductClass");
				can("manage", "Vendor");
				can("manage", "Inventory");
				can("manage", "Component");
				can("manage", "SlsPrc");
				can("manage", "SlsPrcDet");
				can("manage", "Sales");
				can("manage", "ItemCost");
				can("manage", "ItemPrice");
				can("manage", "PriceClass");
				can("manage", "Bundling");
				can("manage", "Dashboard");
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
