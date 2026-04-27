import { defineConfig } from "drizzle-kit";

const DB_NAME = process.env.DB_NAME;
if (!DB_NAME) {
  throw new Error("DB_NAME environment variable is required");
}

export default defineConfig({
  schema: "./src/modules/**/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: DB_NAME,
  },
});
