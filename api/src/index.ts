import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { routes } from "./routes";

// ── Global crash prevention ──────────────────────────────────────────
// Prevent unhandled rejections (e.g. tedious stream-parser disconnect)
// from terminating the process. Log and move on.
process.on("unhandledRejection", (reason) => {
	console.error("[FATAL] Unhandled rejection (process kept alive):", reason);
});
process.on("uncaughtException", (err) => {
	console.error("[FATAL] Uncaught exception (process kept alive):", err);
});

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
