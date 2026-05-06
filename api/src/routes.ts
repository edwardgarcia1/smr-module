import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { authRoutes } from "./modules/users/auth.routes";
import { userRoutes } from "./modules/users/users.routes";
import { inventoryRoutes } from "./modules/inventory/inventory.routes";
import { principalRoutes } from "./modules/principal/principal.routes";
import { itemRoutes } from "./modules/item/item.routes";
import { priceRoutes } from "./modules/price/price.routes";
import { errorMiddleware } from "./middlewares/error";

export const routes = new Elysia({ prefix: "/api" })
    .use(swagger({
        path: "/docs",
    }))
    .use(errorMiddleware)
    .use(authRoutes)
    .use(userRoutes)
    .use(inventoryRoutes)
    .use(principalRoutes)
    .use(itemRoutes)
    .use(priceRoutes);
