import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { routes } from "./routes";

const app = new Elysia()
	.use(
		cors({
			origin: process.env.CORS_ORIGIN || "http://localhost:5173",
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			credentials: true,
		}),
	)
	.use(routes)
	.listen(3000);

console.log("Server is running on http://localhost:3000");

export type App = typeof app;
