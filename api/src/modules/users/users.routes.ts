import { Elysia } from "elysia";
import { findUserById, getAllUsers } from "./service";
import { authGuard } from "../../middlewares/auth";
import { rateLimitMiddleware } from "../../middlewares/rateLimit";
import { caslMiddleware, checkPermission } from "../../middlewares/casl";
import {
    BadRequestError,
    NotFoundError,
    UnauthorizedError,
} from "../../middlewares/error";

export const userRoutes = new Elysia({ prefix: "/users" })
    .use(rateLimitMiddleware)
    .use(authGuard)
    .use(caslMiddleware)
    .get("/", async ({ rateLimit, limited, ability, user }) => {
        if (limited) {
            throw new BadRequestError("Rate limit exceeded");
        }

        if (!user) {
            throw new UnauthorizedError("Authentication required");
        }

        // CASL RBAC check
        checkPermission(ability, "read", "User");

        const users = await getAllUsers();
        return users.map(({ password, ...rest }) => rest);
    })
    .get("/profile", async ({ user }) => {
        // user is provided by authGuard
        if (!user) {
            throw new UnauthorizedError("Authentication required");
        }

        const userProfile = await findUserById(user.id);
        if (!userProfile) {
            throw new NotFoundError("User not found");
        }
        const { password, ...rest } = userProfile;
        return rest;
    });
