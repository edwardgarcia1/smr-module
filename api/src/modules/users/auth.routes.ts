import { Elysia, t } from "elysia";
import {
    createUser,
    findUserByUsername,
    findUserById,
    validatePassword,
} from "./service";
import { jwtMiddleware, refreshTokenMiddleware } from "../../middlewares/jwt";
import { rateLimitMiddleware } from "../../middlewares/rateLimit";
import { authGuard } from "../../middlewares/auth";
import { BadRequestError, UnauthorizedError } from "../../middlewares/error";
import { extractAndVerifyToken } from "../../shared/auth";

export const authRoutes = new Elysia({ prefix: "/auth" })
    .use(rateLimitMiddleware)
    .use(jwtMiddleware)
    .use(refreshTokenMiddleware)
    .post(
        "/register",
        async ({ body, rateLimit, limited }) => {
            if (limited) {
                throw new BadRequestError("Rate limit exceeded");
            }

            const bodyTyped = body as {
                username: string;
                password: string;
                name: string;
            };

            const existingUser = await findUserByUsername(bodyTyped.username);
            if (existingUser) {
                throw new BadRequestError("Username already exists");
            }
            const user = await createUser(bodyTyped);
            return { message: "User registered successfully", userId: user.id };
        },
        {
            body: t.Object({
                username: t.String(),
                password: t.String(),
                name: t.String(),
            }),
        },
    )
    .post(
        "/login",
        async ({ body, rateLimit, limited, jwt, refreshJwt, cookie, headers }) => {
            if (limited) {
                throw new BadRequestError("Rate limit exceeded");
            }

            const bodyTyped = body as { username: string; password: string };

            const user = await findUserByUsername(bodyTyped.username);
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
                role: user.role,
            });

            const refreshToken = await refreshJwt.sign({
                userId: user.id,
                tokenId: Math.random().toString(36).substring(7),
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
                        role: user.role,
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
                    role: user.role,
                },
            };
        },
        {
            body: t.Object({
                username: t.String(),
                password: t.String(),
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
        const user = await findUserById(userId);
        if (!user) {
            throw new UnauthorizedError("User not found");
        }

        const newAccessToken = await jwt.sign({
            id: user.id,
            username: user.username,
            role: user.role,
        });

        const newRefreshToken = await refreshJwt.sign({
            userId: user.id,
            tokenId: Math.random().toString(36).substring(7),
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

        const userProfile = await findUserById(user.id);
        if (!userProfile) {
            throw new UnauthorizedError("User not found");
        }

        const { password, ...userWithoutPassword } = userProfile;
        return userWithoutPassword;
    });
