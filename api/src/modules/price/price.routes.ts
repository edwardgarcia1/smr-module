import { Elysia, t } from "elysia";
import {
	createSlsPrc,
	getSlsPrcById,
	updateSlsPrc,
	deleteSlsPrc,
	createSlsPrcDet,
	getSlsPrcDetByHeaderId,
	getSlsPrcPaginated,
	getSlsPrcDetPaginated,
	getSlsPrcWithDetsPaginated,
	MAX_LIMIT,
	DEFAULT_LIMIT,
} from "./price.service";
import { authGuard } from "../../middlewares/auth";
import { rateLimitMiddleware } from "../../middlewares/rateLimit";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	NotFoundError,
	UnauthorizedError,
} from "../../middlewares/error";

function clamp(val: number, min: number, max: number): number {
	return Math.min(Math.max(val, min), max);
}

export const priceRoutes = new Elysia({ prefix: "/price" })
	.use(rateLimitMiddleware)
	.use(authGuard)
	.use(caslMiddleware)

	// ── SlsPrc (header) routes ───────────────────────────────────────

	// GET /price/ids — paginated list of price headers
	.get(
		"/ids",
		async ({ query, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			const page = clamp(Number(query.page) || 1, 1, Infinity);
			const limit = clamp(Number(query.limit) || DEFAULT_LIMIT, 1, MAX_LIMIT);

			return getSlsPrcPaginated(page, limit);
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	)

	// GET /price/ids/:slsPrcId — single price header
	.get(
		"/ids/:slsPrcId",
		async ({ params: { slsPrcId }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			const prc = await getSlsPrcById(slsPrcId);
			if (!prc) throw new NotFoundError(`SlsPrc ${slsPrcId} not found`);
			return prc;
		},
		{
			params: t.Object({ slsPrcId: t.String() }),
		},
	)

	// POST /price/ids — create price header
	.post(
		"/ids",
		async ({ body, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "create", "Site");

			return createSlsPrc(body);
		},
		{
			body: t.Object({
				SlsPrcID: t.String({ maxLength: 30 }),
				InvtID: t.String({ maxLength: 30 }),
				CatalogNbr: t.String({ maxLength: 50 }),
			}),
		},
	)

	// PUT /price/ids/:slsPrcId — update price header
	.put(
		"/ids/:slsPrcId",
		async ({
			params: { slsPrcId },
			body,
			rateLimit,
			limited,
			ability,
			user,
		}) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "update", "Site");

			return updateSlsPrc(slsPrcId, body);
		},
		{
			params: t.Object({ slsPrcId: t.String() }),
			body: t.Object({
				InvtID: t.Optional(t.String({ maxLength: 30 })),
				CatalogNbr: t.Optional(t.String({ maxLength: 50 })),
			}),
		},
	)

	// DELETE /price/ids/:slsPrcId — delete price header
	.delete(
		"/ids/:slsPrcId",
		async ({ params: { slsPrcId }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "delete", "Site");

			await deleteSlsPrc(slsPrcId);
			return { message: `SlsPrc ${slsPrcId} deleted` };
		},
		{
			params: t.Object({ slsPrcId: t.String() }),
		},
	)

	// ── SlsPrcDet (detail) routes ────────────────────────────────────

	// GET /price/value — paginated list of all values
	.get(
		"/value",
		async ({ query, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			const page = clamp(Number(query.page) || 1, 1, Infinity);
			const limit = clamp(Number(query.limit) || DEFAULT_LIMIT, 1, MAX_LIMIT);

			return getSlsPrcDetPaginated(page, limit);
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	)

	// GET /price/value/:slsPrcId — details by header
	.get(
		"/value/:slsPrcId",
		async ({ params: { slsPrcId }, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			return getSlsPrcDetByHeaderId(slsPrcId);
		},
		{
			params: t.Object({ slsPrcId: t.String() }),
		},
	)

	// POST /price/value — create detail
	.post(
		"/value",
		async ({ body, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "create", "Site");

			return createSlsPrcDet(body);
		},
		{
			body: t.Object({
				SlsPrcID: t.String({ maxLength: 30 }),
				DiscPrice: t.Number(),
				SlsUnit: t.String({ maxLength: 10 }),
			}),
		},
	)

	// ── Joined route ─────────────────────────────────────────────────

	// GET /price — paginated IDs + Values on SlsPrcID
	.get(
		"/",
		async ({ query, rateLimit, limited, ability, user }) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			const page = clamp(Number(query.page) || 1, 1, Infinity);
			const limit = clamp(Number(query.limit) || DEFAULT_LIMIT, 1, MAX_LIMIT);

			return getSlsPrcWithDetsPaginated(page, limit);
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	);
