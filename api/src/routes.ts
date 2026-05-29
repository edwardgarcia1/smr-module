import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { authRoutes } from "./modules/users/auth.routes";
import { userRoutes } from "./modules/users/users.routes";
import { inventoryRoutes } from "./modules/inventory/inventory.routes";
import { principalRoutes } from "./modules/principal/principal.routes";
import { itemRoutes } from "./modules/item/item.routes";
import { priceRoutes } from "./modules/price/price.routes";
import { lookupsRoutes } from "./modules/lookups/lookups.routes";
import { purchasingRoutes } from "./modules/purchasing/purchasing.routes";
import { bundlingRoutes } from "./modules/bundling/bundling.routes";
import { minStockRoutes } from "./modules/min-stock/min-stock.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
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
    .use(priceRoutes)
    .use(lookupsRoutes)
    .use(purchasingRoutes)
    .use(bundlingRoutes)
    .use(minStockRoutes)
    .use(dashboardRoutes);
