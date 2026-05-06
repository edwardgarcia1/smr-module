import { getDb } from "../../config/db";
import { BadRequestError } from "../../middlewares/error";
import type { User, NewUser } from "./schema";

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

export const createUser = async (user: NewUser): Promise<User> => {
  const passwordValidation = validatePasswordStrength(user.password);
  if (!passwordValidation.valid) {
    throw new BadRequestError(passwordValidation.error);
  }

  const hashedPassword = await Bun.password.hash(user.password, {
    algorithm: "bcrypt",
    cost: 10,
  });

  const pool = await getDb();
  const result = await pool
    .request()
    .input("username", user.username)
    .input("password", hashedPassword)
    .input("name", user.name)
    .input("role", user.role || "user")
    .query(`
      INSERT INTO SMR_Users (username, password, name, role)
      OUTPUT INSERTED.id, INSERTED.username, INSERTED.password, INSERTED.name, INSERTED.role
      VALUES (@username, @password, @name, @role)
    `);

  const createdUser = result.recordset[0];
  if (!createdUser) {
    throw new Error("Failed to create user");
  }
  return createdUser as User;
};

export const findUserByUsername = async (
  username: string,
): Promise<User | undefined> => {
  const pool = await getDb();
  const result = await pool
    .request()
    .input("username", username)
    .query("SELECT * FROM SMR_Users WHERE username = @username");

  return result.recordset[0] as User | undefined;
};

export const findUserById = async (id: number): Promise<User | undefined> => {
  const pool = await getDb();
  const result = await pool
    .request()
    .input("id", id)
    .query("SELECT * FROM SMR_Users WHERE id = @id");

  return result.recordset[0] as User | undefined;
};

export const getAllUsers = async (): Promise<User[]> => {
  const pool = await getDb();
  const result = await pool.request().query("SELECT * FROM SMR_Users");
  return result.recordset as User[];
};

export const validatePassword = async (
  password: string,
  hashedPassword: string,
) => {
  return Bun.password.verify(password, hashedPassword);
};
