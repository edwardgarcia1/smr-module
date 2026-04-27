import { db } from "../../config/db";
import { BadRequestError } from "../../middlewares/error";
import { users, type NewUser } from "./schema";
import { eq } from "drizzle-orm";

const validatePasswordStrength = (
	password: string,
): { valid: boolean; error?: string } => {
	if (password.length < 8) {
		return {
			valid: false,
			error: "Password must be at least 8 characters long",
		};
	}
	if (!/[A-Z]/.test(password)) {
		return {
			valid: false,
			error: "Password must contain at least one uppercase letter",
		};
	}
	if (!/[a-z]/.test(password)) {
		return {
			valid: false,
			error: "Password must contain at least one lowercase letter",
		};
	}
	if (!/[0-9]/.test(password)) {
		return { valid: false, error: "Password must contain at least one number" };
	}
	return { valid: true };
};

export const createUser = async (user: NewUser) => {
	const passwordValidation = validatePasswordStrength(user.password);
	if (!passwordValidation.valid) {
		throw new BadRequestError(passwordValidation.error);
	}

	const hashedPassword = await Bun.password.hash(user.password, {
		algorithm: "bcrypt",
		cost: 10,
	});
	const newUser = { ...user, password: hashedPassword };
	const [createdUser] = await db.insert(users).values(newUser).returning();
	if (!createdUser) {
		throw new Error("Failed to create user");
	}
	return createdUser;
};

export const findUserByUsername = async (username: string) => {
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.username, username));
	return user;
};

export const findUserById = async (id: number) => {
	const [user] = await db.select().from(users).where(eq(users.id, id));
	return user;
};

export const getAllUsers = async () => {
	return db.select().from(users);
};

export const validatePassword = async (
	password: string,
	hashedPassword: string,
) => {
	return Bun.password.verify(password, hashedPassword);
};
