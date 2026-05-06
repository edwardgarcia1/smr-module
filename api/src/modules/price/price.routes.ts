import { Elysia, t } from "elysia";
import {
	createSlsPrc,
	getAllSlsPrc,
	getSlsPrcById,
	updateSlsPrc,
	deleteSlsPrc,
	createSlsPrcDet,
	getAllSlsPrcDet,
	getSlsPrcDetByHeaderId,
	getSlsPrcWithDets,
} from "./price.service";
import { authGuard } from "../../middlewares/auth";
import { rateLimitMiddleware } from "../../middlewares/rateLimit";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
	BadRequestError,
	NotFoundError,
	UnauthorizedError,
} from "../../middlewares/error";

export const priceRoutes = new Elysia({ prefix: "/price" })
	.use(rateLimitMiddleware)
	.use(authGuard)
	.use(caslMiddleware)

	// ── SlsPrc (header) routes ───────────────────────────────────────

	// GET /price/sls-prc — list all price headers
	.get("/sls-prc", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");

		return getAllSlsPrc();
	})

	// GET /price/sls-prc/:slsPrcId — single price header
	.get(
		"/sls-prc/:slsPrcId",
		async ({
			params: { slsPrcId },
			rateLimit,
			limited,
			ability,
			user,
		}) => {
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

	// POST /price/sls-prc — create price header
	.post(
		"/sls-prc",
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

	// PUT /price/sls-prc/:slsPrcId — update price header
	.put(
		"/sls-prc/:slsPrcId",
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

	// DELETE /price/sls-prc/:slsPrcId — delete price header
	.delete(
		"/sls-prc/:slsPrcId",
		async ({
			params: { slsPrcId },
			rateLimit,
			limited,
			ability,
			user,
		}) => {
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

	// GET /price/sls-prc-det — list all details
	.get("/sls-prc-det", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");

		return getAllSlsPrcDet();
	})

	// GET /price/sls-prc-det/:slsPrcId — details by header
	.get(
		"/sls-prc-det/:slsPrcId",
		async ({
			params: { slsPrcId },
			rateLimit,
			limited,
			ability,
			user,
		}) => {
			if (limited) throw new BadRequestError("Rate limit exceeded");
			if (!user) throw new UnauthorizedError("Authentication required");
			checkPermission(ability, "read", "Site");

			return getSlsPrcDetByHeaderId(slsPrcId);
		},
		{
			params: t.Object({ slsPrcId: t.String() }),
		},
	)

	// POST /price/sls-prc-det — create detail
	.post(
		"/sls-prc-det",
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

	// GET /price — SlsPrc + SlsPrcDet on SlsPrcID
	.get("/", async ({ rateLimit, limited, ability, user }) => {
		if (limited) throw new BadRequestError("Rate limit exceeded");
		if (!user) throw new UnauthorizedError("Authentication required");
		checkPermission(ability, "read", "Site");

		return getSlsPrcWithDets();
	});
