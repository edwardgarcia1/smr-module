import { Elysia } from "elysia";

export class CustomError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
    }
}

export class BadRequestError extends CustomError {
    constructor(message: string = "Bad Request") {
        super(message, 400);
    }
}

export class UnauthorizedError extends CustomError {
    constructor(message: string = "Unauthorized") {
        super(message, 401);
    }
}

export class ForbiddenError extends CustomError {
    constructor(message: string = "Forbidden") {
        super(message, 403);
    }
}

export class NotFoundError extends CustomError {
    constructor(message: string = "Not Found") {
        super(message, 404);
    }
}

export const errorMiddleware = (app: Elysia) => {
    return app.onError(({ error, set }) => {
        console.error("Error:", error);

        if (error instanceof CustomError) {
            set.status = error.statusCode;
            return {
                error: error.message,
                statusCode: error.statusCode,
            };
        }

        // Handle Elysia validation errors
        if (error && typeof error === "object" && "code" in error && error.code === "VALIDATION") {
            set.status = 400;
            return {
                error: "Validation failed",
                details: (error as any).message,
                statusCode: 400,
            };
        }

        // Default error response
        set.status = 500;
        return {
            error: "Internal Server Error",
            statusCode: 500,
        };
    });
};
