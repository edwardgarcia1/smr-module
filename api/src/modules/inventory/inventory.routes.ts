import { Elysia, t } from "elysia";
import {
  createSite,
  getAllSites,
  getSiteById,
  updateSite,
  deleteSite,
} from "./service";
import { authGuard } from "../../middlewares/auth";
import { rateLimitMiddleware } from "../../middlewares/rateLimit";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../../middlewares/error";

export const inventoryRoutes = new Elysia({ prefix: "/inventory" })
  .use(rateLimitMiddleware)
  .use(authGuard)
  .use(caslMiddleware)

  // GET /inventory — list all sites
  .get("/", async ({ rateLimit, limited, ability, user }) => {
    if (limited) throw new BadRequestError("Rate limit exceeded");
    if (!user) throw new UnauthorizedError("Authentication required");
    checkPermission(ability, "read", "Site");

    return getAllSites();
  })

  // GET /inventory/:siteId — get single site
  .get(
    "/:siteId",
    async ({ params: { siteId }, rateLimit, limited, ability, user }) => {
      if (limited) throw new BadRequestError("Rate limit exceeded");
      if (!user) throw new UnauthorizedError("Authentication required");
      checkPermission(ability, "read", "Site");

      const site = await getSiteById(siteId);
      if (!site) throw new NotFoundError(`Site ${siteId} not found`);
      return site;
    },
    {
      params: t.Object({ siteId: t.String() }),
    },
  )

  // POST /inventory — create site
  .post(
    "/",
    async ({ body, rateLimit, limited, ability, user }) => {
      if (limited) throw new BadRequestError("Rate limit exceeded");
      if (!user) throw new UnauthorizedError("Authentication required");
      checkPermission(ability, "create", "Site");

      return createSite(body);
    },
    {
      body: t.Object({
        SiteId: t.String({ maxLength: 10 }),
        Name: t.String({ maxLength: 30 }),
      }),
    },
  )

  // PUT /inventory/:siteId — update site name
  .put(
    "/:siteId",
    async ({ params: { siteId }, body, rateLimit, limited, ability, user }) => {
      if (limited) throw new BadRequestError("Rate limit exceeded");
      if (!user) throw new UnauthorizedError("Authentication required");
      checkPermission(ability, "update", "Site");

      return updateSite(siteId, body);
    },
    {
      params: t.Object({ siteId: t.String() }),
      body: t.Object({
        Name: t.String({ maxLength: 30 }),
      }),
    },
  )

  // DELETE /inventory/:siteId — delete site
  .delete(
    "/:siteId",
    async ({ params: { siteId }, rateLimit, limited, ability, user }) => {
      if (limited) throw new BadRequestError("Rate limit exceeded");
      if (!user) throw new UnauthorizedError("Authentication required");
      checkPermission(ability, "delete", "Site");

      await deleteSite(siteId);
      return { message: `Site ${siteId} deleted` };
    },
    {
      params: t.Object({ siteId: t.String() }),
    },
  );
