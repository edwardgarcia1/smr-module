import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { users, type NewUser } from "./modules/users/schema";
import { eq } from "drizzle-orm";

const client = new Client({
	host: process.env.DB_HOST || "localhost",
	port: Number(process.env.DB_PORT) || 5432,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
});

await client.connect();

const db = drizzle(client);

try {
	console.log("Running migrations...");
	await migrate(db, { migrationsFolder: "./drizzle" });
	console.log("Migrations completed successfully");

	console.log("Checking for superadmin user...");
	const [existingUser] = await db
		.select()
		.from(users)
		.where(eq(users.username, process.env.SUPERADMIN_USERNAME || "superadmin"));

	if (!existingUser) {
		console.log("Creating superadmin user...");
		const hashedPassword = await Bun.password.hash(
			process.env.SUPERADMIN_PASSWORD || "Passw0rd",
			{
				algorithm: "bcrypt",
				cost: 10,
			},
		);
		const superadminUser: NewUser = {
			username: process.env.SUPERADMIN_USERNAME || "superadmin",
			password: hashedPassword,
			name: process.env.SUPERADMIN_NAME || "Super Admin",
			role: "superadmin",
		};
		await db.insert(users).values(superadminUser);
		console.log("Superadmin user created successfully");
	} else {
		console.log("Superadmin user already exists");
	}
} catch (error) {
	console.error("Migration or user creation failed:", error);
	process.exit(1);
} finally {
	await client.end();
}
