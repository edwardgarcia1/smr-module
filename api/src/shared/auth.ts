import { UnauthorizedError } from "../middlewares/error";
import type { DecodedToken } from "../middlewares/jwt";

export async function extractAndVerifyToken(jwt: any, headers: any, cookie: any): Promise<DecodedToken> {
    const authHeader = headers.authorization;
    let token: string | null = null;

    if (
        authHeader &&
        typeof authHeader === "string" &&
        authHeader.startsWith("Bearer ")
    ) {
        token = authHeader.substring(7);
    } else if (
        (cookie as any)?.accessToken.value &&
        typeof (cookie as any).accessToken.value === "string"
    ) {
        token = (cookie as any).accessToken.value;
    }

    if (!token) {
        throw new UnauthorizedError("No authentication token provided");
    }

    const decodedUser = await jwt.verify(token);

    if (!decodedUser) {
        throw new UnauthorizedError("Invalid token");
    }

    return decodedUser as DecodedToken;
}
