import { Elysia } from "elysia";
import { jwtMiddleware } from "./jwt";
import { findUserById } from "../modules/users/user.service";
import { getTenant } from "../config/tenants";

export interface AuthUser {
	id: number;
	username: string;
	name: string;
	tenant: string;
}

declare module "elysia" {
	interface State {
		user: AuthUser | null;
	}
}

export const authGuard = (app: Elysia) =>
	app.use(jwtMiddleware).derive(async ({ jwt, cookie, headers }) => {
		let token: string | null = null;

		// Check Authorization header first
		const authHeader = headers.authorization;
		if (
			authHeader &&
			typeof authHeader === "string" &&
			authHeader.startsWith("Bearer ")
		) {
			token = authHeader.substring(7);
		}
		// Check cookie for Bearer token
		else if (
			(cookie as any)?.authorization &&
			typeof (cookie as any).authorization === "string" &&
			(cookie as any).authorization.startsWith("Bearer ")
		) {
			token = (cookie as any).authorization.substring(7);
		}
		// Check access token cookie
		else if (
			(cookie as any)?.accessToken.value &&
			typeof (cookie as any).accessToken.value === "string"
		) {
			token = (cookie as any).accessToken.value;
		}

		if (!token) {
			return { user: null };
		}

		try {
			const decoded = await jwt.verify(token);
			const userId = (decoded as any).id;
			const tenant = (decoded as any).tenant ?? "default";

			// Reject tokens for tenants that no longer exist in config
			if (!getTenant(tenant)) {
				console.warn(`[Auth] Rejecting token for unknown tenant: ${tenant}`);
				return { user: null };
			}

			const user = await findUserById(userId, tenant);

			if (!user) {
				return { user: null };
			}

			const { password, ...userWithoutPassword } = user;

			return {
				user: {
					id: userWithoutPassword.id,
					username: userWithoutPassword.username,
					name: userWithoutPassword.name,
					tenant,
				},
			};
		} catch {
			return { user: null };
		}
	});
