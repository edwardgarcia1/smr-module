import { Elysia } from "elysia";
import { authGuard } from "../../middlewares/auth";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import { UnauthorizedError } from "../../middlewares/error";
import { getDashboardSummary } from "./dashboard.service";

export const dashboardRoutes = new Elysia({ prefix: "/dashboard" })
	.use(authGuard)
	.use(caslMiddleware)

	// GET /dashboard/summary — lightweight aggregated dashboard snapshot
	.get("/summary", async ({ ability, user }) => {
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Dashboard");
		return getDashboardSummary();
	});
