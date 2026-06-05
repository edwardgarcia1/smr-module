import { Elysia } from "elysia";
import { getTenants } from "../../config/tenants";

export const tenantRoutes = new Elysia({ prefix: "/tenants" }).get("/", () =>
	getTenants().map((t) => ({
		key: t.key,
		displayName: t.displayName,
	})),
);
