import { Elysia } from "elysia";
import { authGuard } from "../../middlewares/auth";
import { UnauthorizedError } from "../../middlewares/error";
import { getDashboardSummary } from "./dashboard.service";

export const dashboardRoutes = new Elysia({ prefix: "/dashboard" })
	.use(authGuard)

	// GET /dashboard/summary — lightweight aggregated dashboard snapshot
	// Accessible to all authenticated users (no permission check).
	.get("/summary", async ({ user }) => {
		if (!user) throw new UnauthorizedError("Authentication required");
		return getDashboardSummary();
	});
