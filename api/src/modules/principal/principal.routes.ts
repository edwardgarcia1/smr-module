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
import { withCache, invalidateCachePrefix } from "../../utils/cache";

/** Cache TTL for reference data: 5 minutes */
const REF_CACHE_TTL = 5 * 60 * 1000;
const CACHE_PREFIX = "principal:";

export const principalRoutes = new Elysia({ prefix: "/principal" })
	.use(rateLimitMiddleware)
	.use(authGuard)
	.use(caslMiddleware)

	// ── ProductClass routes ──────────────────────────────────────────

	// GET /principal/ids — list all principal identifiers (cached 5 min)
	.get("/ids", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");

		return withCache(`${CACHE_PREFIX}ids`, REF_CACHE_TTL, getAllProductClasses);
	})

	// GET /principal/ids/:classId — single principal by classId
	.get(
		"/ids/:classId",
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

	// POST /principal/ids — create principal
	.post(
		"/ids",
		async ({ body, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "create", "Site");

			invalidateCachePrefix(CACHE_PREFIX);
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

	// PUT /principal/ids/:classId — update principal
	.put(
		"/ids/:classId",
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

			invalidateCachePrefix(CACHE_PREFIX);
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

	// DELETE /principal/ids/:classId — delete product class
	.delete(
		"/ids/:classId",
		async ({ params: { classId }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "delete", "Site");

			invalidateCachePrefix(CACHE_PREFIX);
			await deleteProductClass(classId);
			return { message: `ProductClass ${classId} deleted` };
		},
		{
			params: t.Object({ classId: t.String() }),
		},
	)

	// ── Address routes ────────────────────────────────────────────────

	// GET /principal/address — list all principal address (cached 5 min)
	.get("/address", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");

		return withCache(`${CACHE_PREFIX}address`, REF_CACHE_TTL, getAllVendors);
	})

	// GET /principal/address/:venId — single address
	.get(
		"/address/:venId",
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

	// POST /principal/address — create address for a principal
	.post(
		"/address",
		async ({ body, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "create", "Site");

			invalidateCachePrefix(CACHE_PREFIX);
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

	// PUT /principal/address/:venId — update address
	.put(
		"/address/:venId",
		async ({ params: { venId }, body, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "update", "Site");

			invalidateCachePrefix(CACHE_PREFIX);
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

	// DELETE /principal/address/:venId — delete address
	.delete(
		"/address/:venId",
		async ({ params: { venId }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "delete", "Site");

			invalidateCachePrefix(CACHE_PREFIX);
			await deleteVendor(venId);
			return { message: `Vendor ${venId} deleted` };
		},
		{
			params: t.Object({ venId: t.String() }),
		},
	)

	// ── Joined route ─────────────────────────────────────────────────

	// GET /principal — Principal IDs + Address on User5 = VendId (cached 5 min)
	.get("/", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");

		return withCache(`${CACHE_PREFIX}joined`, REF_CACHE_TTL, getProductClassesWithVendors);
	});
