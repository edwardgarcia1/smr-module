import { Elysia, t } from "elysia";
import {
	getAllPurchaseOrders,
	getPurchaseOrderById,
	createPurchaseOrder,
	updatePurchaseOrderCsv,
	deletePurchaseOrder,
} from "./purchase-order.service";
import { authGuard } from "../../middlewares/auth";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	UnauthorizedError,
} from "../../middlewares/error";

export const purchaseOrderRoutes = new Elysia({ prefix: "/purchase-order" })
	.use(authGuard)
	.use(caslMiddleware)

	/**
	 * GET /purchase-order — list all saved purchase orders
	 */
	.get("/", async ({ ability, user }) => {
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "PurchaseOrder");
		return getAllPurchaseOrders();
	})

	/**
	 * GET /purchase-order/:id — get a single PO with its CSV data
	 */
	.get(
		"/:id",
		async ({ params: { id }, ability, user }) => {
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "PurchaseOrder");
			return getPurchaseOrderById(id);
		},
		{ params: t.Object({ id: t.Numeric() }) },
	)

	/**
	 * POST /purchase-order — save a new purchase order snapshot
	 *
	 * Body:
	 *   refNum       — Reference number for this PO
	 *   principalId  — Principal ClassID
	 *   siteId       — Selected site ID(s), joined by ","
	 *   demandMode   — "average" | "highest"
	 *   frequency    — "monthly" | "weekly"
	 *   salesFrom    — YYYY-MM-DD
	 *   salesTo      — YYYY-MM-DD
	 *   rows         — Array of grid row objects (key/value)
	 */
	.post(
		"/",
		async ({ body, ability, user }) => {
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "create", "PurchaseOrder");

			const { refNum, principalId, siteId, demandMode, frequency, salesFrom, salesTo, rows, preparedBy } = body;

			if (!refNum || refNum.trim().length === 0) {
				throw new BadRequestError("refNum is required");
			}
			if (!rows || !Array.isArray(rows) || rows.length === 0) {
				throw new BadRequestError("rows must be a non-empty array");
			}

			return createPurchaseOrder(
				{
					ref_num: refNum,
					principal_id: principalId ?? "",
					site_id: siteId ?? "",
					demand_mode: demandMode ?? "average",
					frequency: frequency ?? "monthly",
					sales_from: salesFrom,
					sales_to: salesTo,
					prepared_by: preparedBy ?? "",
				},
				rows,
			);
		},
		{
			body: t.Object({
				refNum: t.String(),
				principalId: t.Optional(t.String()),
				siteId: t.String(),
				demandMode: t.String(),
				frequency: t.String(),
				salesFrom: t.String(),
				salesTo: t.String(),
				preparedBy: t.Optional(t.String()),
				rows: t.Array(t.Record(t.String(), t.Any())),
			}),
		},
	)

	/**
	 * PATCH /purchase-order/:id — update PO CSV data (inline edits).
	 * Rewrites the CSV file on disk and records who made the change.
	 */
	.patch(
		"/:id",
		async ({ params: { id }, body, ability, user }) => {
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "update", "PurchaseOrder");

			if (!body.rows || !Array.isArray(body.rows) || body.rows.length === 0) {
				throw new BadRequestError("rows must be a non-empty array");
			}

			return updatePurchaseOrderCsv(id, body.rows, user.name);
		},
		{
			params: t.Object({ id: t.Numeric() }),
			body: t.Object({
				rows: t.Array(t.Record(t.String(), t.Any())),
			}),
		},
	)

	/**
	 * DELETE /purchase-order/:id — delete a purchase order and its CSV file
	 */
	.delete(
		"/:id",
		async ({ params: { id }, ability, user }) => {
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "delete", "PurchaseOrder");
			await deletePurchaseOrder(id);
			return { message: `PurchaseOrder ${id} deleted` };
		},
		{ params: t.Object({ id: t.Numeric() }) },
	);
