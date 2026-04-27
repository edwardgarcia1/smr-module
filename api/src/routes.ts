import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { authRoutes } from "./modules/users/auth.routes";
import { userRoutes } from "./modules/users/users.routes";
import { errorMiddleware } from "./middlewares/error";

export const routes = new Elysia({ prefix: "/api" })
    .use(swagger({
        path: "/docs",
    }))
    .use(errorMiddleware)
    .use(authRoutes)
    .use(userRoutes);
