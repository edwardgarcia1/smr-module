import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";

export interface DecodedToken {
  id: number;
  username: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: number;
  tokenId: string;
}

export const jwtMiddleware = (app: Elysia) =>
  app.use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "your-secret-key",
      alg: "HS256",
      exp: "1h",
    })
  );

export const refreshTokenMiddleware = (app: Elysia) =>
  app.use(
    jwt({
      name: "refreshJwt",
      secret: process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key",
      alg: "HS256",
      exp: "7d",
    })
  );