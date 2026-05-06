import { Elysia, t } from "elysia";
import {
	createProductClass,
	getAllProductClasses,
	getProductClassById,
	updateProductClass,
	deleteProductClass,
	createVendor,
	getAllVendors,
	getVendorById,
	updateVendor,
	deleteVendor,
	getProductClassesWithVendors,
} from "./principal.service";
import { authGuard } from "../../middlewares/auth";
import { rateLimitMiddleware } from "../../middlewares/rateLimit";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	NotFoundError,
	UnauthorizedError,
} from "../../middlewares/error";

export const principalRoutes = new Elysia({ prefix: "/principal" })
	.use(rateLimitMiddleware)
	.use(authGuard)
	.use(caslMiddleware)

	// ── ProductClass routes ──────────────────────────────────────────

	// GET /principal/product-class — list all product classes
	.get("/product-class", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");

		return getAllProductClasses();
	})

	// GET /principal/product-class/:classId — single product class
	.get(
		"/product-class/:classId",
		async ({ params: { classId }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			const pc = await getProductClassById(classId);
			if (!pc) throw new NotFoundError(`ProductClass ${classId} not found`);
			return pc;
		},
		{
			params: t.Object({ classId: t.String() }),
		},
	)

	// POST /principal/product-class — create product class
	.post(
		"/product-class",
		async ({ body, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "create", "Site");

			return createProductClass(body);
		},
		{
			body: t.Object({
				ClassID: t.String({ maxLength: 10 }),
				Descr: t.String({ maxLength: 100 }),
				User5: t.String({ maxLength: 10 }),
			}),
		},
	)

	// PUT /principal/product-class/:classId — update product class
	.put(
		"/product-class/:classId",
		async ({
			params: { classId },
			body,
			rateLimit,
			limited,
			ability,
			user,
		}) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "update", "Site");

			return updateProductClass(classId, body);
		},
		{
			params: t.Object({ classId: t.String() }),
			body: t.Object({
				Descr: t.Optional(t.String({ maxLength: 100 })),
				User5: t.Optional(t.String({ maxLength: 10 })),
			}),
		},
	)

	// DELETE /principal/product-class/:classId — delete product class
	.delete(
		"/product-class/:classId",
		async ({ params: { classId }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "delete", "Site");

			await deleteProductClass(classId);
			return { message: `ProductClass ${classId} deleted` };
		},
		{
			params: t.Object({ classId: t.String() }),
		},
	)

	// ── Vendor routes ────────────────────────────────────────────────

	// GET /principal/vendor — list all vendors
	.get("/vendor", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");

		return getAllVendors();
	})

	// GET /principal/vendor/:venId — single vendor
	.get(
		"/vendor/:venId",
		async ({ params: { venId }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			const vendor = await getVendorById(venId);
			if (!vendor) throw new NotFoundError(`Vendor ${venId} not found`);
			return vendor;
		},
		{
			params: t.Object({ venId: t.String() }),
		},
	)

	// POST /principal/vendor — create vendor
	.post(
		"/vendor",
		async ({ body, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "create", "Site");

			return createVendor(body);
		},
		{
			body: t.Object({
				VendId: t.String({ maxLength: 10 }),
				Addr1: t.String({ maxLength: 100 }),
				Addr2: t.String({ maxLength: 100 }),
				City: t.String({ maxLength: 50 }),
				Terms: t.String({ maxLength: 50 }),
			}),
		},
	)

	// PUT /principal/vendor/:venId — update vendor
	.put(
		"/vendor/:venId",
		async ({ params: { venId }, body, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "update", "Site");

			return updateVendor(venId, body);
		},
		{
			params: t.Object({ venId: t.String() }),
			body: t.Object({
				Addr1: t.Optional(t.String({ maxLength: 100 })),
				Addr2: t.Optional(t.String({ maxLength: 100 })),
				City: t.Optional(t.String({ maxLength: 50 })),
				Terms: t.Optional(t.String({ maxLength: 50 })),
			}),
		},
	)

	// DELETE /principal/vendor/:venId — delete vendor
	.delete(
		"/vendor/:venId",
		async ({ params: { venId }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "delete", "Site");

			await deleteVendor(venId);
			return { message: `Vendor ${venId} deleted` };
		},
		{
			params: t.Object({ venId: t.String() }),
		},
	)

	// ── Joined route ─────────────────────────────────────────────────

	// GET /principal/joined — ProductClass + Vendor on User5 = VendId
	.get("/", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");

		return getProductClassesWithVendors();
	});
