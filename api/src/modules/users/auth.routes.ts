import { Elysia, t } from "elysia";
import {
	createUser,
	findUserByUsername,
	findUserById,
	validatePassword,
} from "./user.service";
import { jwtMiddleware, refreshTokenMiddleware } from "../../middlewares/jwt";
import { authGuard } from "../../middlewares/auth";
import { BadRequestError, UnauthorizedError } from "../../middlewares/error";
import { getTenant } from "../../config/tenants";

export const authRoutes = new Elysia({ prefix: "/auth" })
	.use(jwtMiddleware)
	.use(refreshTokenMiddleware)
	.post(
		"/register",
		async ({ body }) => {
			const bodyTyped = body as {
				username: string;
				password: string;
				name: string;
				tenant?: string;
			};
			const effectiveTenant = bodyTyped.tenant || "default";

			if (!getTenant(effectiveTenant)) {
				throw new BadRequestError(`Unknown tenant: ${effectiveTenant}`);
			}

			const existingUser = await findUserByUsername(bodyTyped.username, effectiveTenant);
			if (existingUser) {
				throw new BadRequestError("Username already exists");
			}
			const user = await createUser(bodyTyped, effectiveTenant);
			return { message: "User registered successfully", userId: user.id };
		},
		{
			body: t.Object({
				username: t.String(),
				password: t.String(),
				name: t.String(),
				tenant: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"/login",
		async ({ body, jwt, refreshJwt, cookie, headers }) => {
			const bodyTyped = body as { username: string; password: string; tenant?: string };
			const effectiveTenant = bodyTyped.tenant || "default";

			// Validate tenant exists before attempting DB connect
			if (!getTenant(effectiveTenant)) {
				throw new BadRequestError(`Unknown tenant: ${effectiveTenant}`);
			}

			const user = await findUserByUsername(bodyTyped.username, effectiveTenant);
			if (!user) {
				throw new UnauthorizedError("Invalid credentials");
			}
			const isValid = await validatePassword(bodyTyped.password, user.password);
			if (!isValid) {
				throw new UnauthorizedError("Invalid credentials");
			}

			const accessToken = await jwt.sign({
				id: user.id,
				username: user.username,
				tenant: effectiveTenant,
			});

			const refreshToken = await refreshJwt.sign({
				userId: user.id,
				tokenId: Math.random().toString(36).substring(7),
				tenant: effectiveTenant,
			});

			const isMobile = headers?.["x-client-type"] === "mobile";

			if (isMobile) {
				return {
					accessToken,
					refreshToken,
					user: {
						id: user.id,
						username: user.username,
						name: user.name,
						tenant: effectiveTenant,
					},
				};
			}

			const isProd = process.env.NODE_ENV === "production";

			(cookie as any).accessToken.set({
				value: accessToken,
				httpOnly: true,
				secure: isProd,
				sameSite: "lax",
				path: "/",
				maxAge: 60 * 15,
			});

			(cookie as any).refreshToken.set({
				value: refreshToken,
				httpOnly: true,
				secure: isProd,
				sameSite: "lax",
				path: "/",
				maxAge: 60 * 60 * 24 * 7,
			});

			return {
				message: "Logged in successfully",
				user: {
					id: user.id,
					username: user.username,
					name: user.name,
					tenant: effectiveTenant,
				},
			};
		},
		{
			body: t.Object({
				username: t.String(),
				password: t.String(),
				tenant: t.Optional(t.String()),
			}),
		},
	)
	.post("/logout", async ({ cookie }) => {
		const isProd = process.env.NODE_ENV === "production";

		(cookie as any).accessToken.set({
			value: "",
			httpOnly: true,
			secure: isProd,
			sameSite: "lax",
			path: "/",
			maxAge: 0,
		});

		(cookie as any).refreshToken.set({
			value: "",
			httpOnly: true,
			secure: isProd,
			sameSite: "lax",
			path: "/",
			maxAge: 0,
		});

		return { message: "Logged out successfully" };
	})
	.post("/refresh", async ({ refreshJwt, jwt, cookie }) => {
		const refreshTokenVal = (cookie as any)?.refreshToken.value;
		const refreshToken =
			typeof refreshTokenVal === "string" ? refreshTokenVal : null;

		if (!refreshToken) {
			throw new UnauthorizedError("Refresh token required");
		}

		const decodedRefresh = await refreshJwt.verify(refreshToken);
		if (!decodedRefresh) {
			throw new UnauthorizedError("Invalid refresh token");
		}

		const userId = (decodedRefresh as any).userId;
		const tenant = (decodedRefresh as any).tenant ?? "default";
		const user = await findUserById(userId, tenant);
		if (!user) {
			throw new UnauthorizedError("User not found");
		}

		const newAccessToken = await jwt.sign({
			id: user.id,
			username: user.username,
			tenant,
		});

		const newRefreshToken = await refreshJwt.sign({
			userId: user.id,
			tokenId: Math.random().toString(36).substring(7),
			tenant,
		});

		const isProd = process.env.NODE_ENV === "production";

		(cookie as any).accessToken.set({
			value: newAccessToken,
			httpOnly: true,
			secure: isProd,
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 15,
		});

		(cookie as any).refreshToken.set({
			value: newRefreshToken,
			httpOnly: true,
			secure: isProd,
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 7,
		});

		return {
			message: "Token refreshed successfully",
		};
	})
	.use(authGuard)
	.post("/me", async ({ user }) => {
		if (!user) {
			throw new UnauthorizedError("Authentication required");
		}

		const userProfile = await findUserById(user.id, user.tenant);
		if (!userProfile) {
			throw new UnauthorizedError("User not found");
		}

		const { password, ...userWithoutPassword } = userProfile;
		return { ...userWithoutPassword, tenant: user.tenant };
	});
