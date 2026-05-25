import sql from "mssql";
import { CREATE_USERS_TABLE_SQL } from "./modules/users/user.schema";
import {
	CREATE_ITEMPRICE_TABLE_SQL,
	CREATE_PRICECLASS_TABLE_SQL,
} from "./modules/price/price.schema";
import {
	CREATE_MIN_STOCK_SETTING_TABLE_SQL,
	CREATE_MIN_STOCK_ITEM_TABLE_SQL,
	CREATE_MIN_STOCK_PRINCIPAL_TABLE_SQL,
	CREATE_MIN_STOCK_CATEGORY_TABLE_SQL,
	SEED_DEFAULT_MIN_STOCK_SQL,
	SEED_MIN_STOCK_CATEGORIES_SQL,
} from "./modules/min-stock/min-stock.schema";

const config: sql.config = {
	server: process.env.DB_HOST || "localhost",
	port: Number(process.env.DB_PORT) || 1433,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	options: {
		encrypt: false,
		trustServerCertificate: true,
	},
};

async function migrate() {
	const pool = await sql.connect(config);

	try {
		console.log("Running migrations...");

		// Create SMR_Users table if it doesn't exist
		await pool.request().query(CREATE_USERS_TABLE_SQL);
		console.log("SMR_Users table ready");

		// Create SMR_ItemPrice table (renamed from SMR_ItemCost)
		await pool.request().query(CREATE_ITEMPRICE_TABLE_SQL);
		console.log("SMR_ItemPrice table ready");

		// Create SMR_PriceClass table
		await pool.request().query(CREATE_PRICECLASS_TABLE_SQL);
		console.log("SMR_PriceClass table ready");

		// Create SMR_MinStockSetting table
		await pool.request().query(CREATE_MIN_STOCK_SETTING_TABLE_SQL);
		console.log("SMR_MinStockSetting table ready");

		// Create SMR_MinStockItem table
		await pool.request().query(CREATE_MIN_STOCK_ITEM_TABLE_SQL);
		console.log("SMR_MinStockItem table ready");

		// Create SMR_MinStockPrincipal table
		await pool.request().query(CREATE_MIN_STOCK_PRINCIPAL_TABLE_SQL);
		console.log("SMR_MinStockPrincipal table ready");

		// Seed default min stock row
		await pool.request().query(SEED_DEFAULT_MIN_STOCK_SQL);
		console.log("Default min stock row seeded");

		// Create SMR_MinStockCategory table
		await pool.request().query(CREATE_MIN_STOCK_CATEGORY_TABLE_SQL);
		console.log("SMR_MinStockCategory table ready");

		// Seed min stock categories
		await pool.request().query(SEED_MIN_STOCK_CATEGORIES_SQL);
		console.log("Min stock categories seeded");

		// Seed superadmin if not exists
		const username = process.env.SUPERADMIN_USERNAME || "superadmin";
		const checkResult = await pool
			.request()
			.input("username", username)
			.query(
				"SELECT COUNT(*) AS cnt FROM SMR_Users WHERE username = @username",
			);

		const count = checkResult.recordset[0]?.cnt ?? 0;

		if (count === 0) {
			console.log("Creating superadmin user...");
			const hashedPassword = await Bun.password.hash(
				process.env.SUPERADMIN_PASSWORD || "Passw0rd",
				{ algorithm: "bcrypt", cost: 10 },
			);

			await pool
				.request()
				.input("username", username)
				.input("password", hashedPassword)
				.input("name", process.env.SUPERADMIN_NAME || "Super Admin")
				.input("role", "superadmin").query(`
          INSERT INTO SMR_Users (username, password, name, role)
          VALUES (@username, @password, @name, @role)
        `);

			console.log("Superadmin user created successfully");
		} else {
			console.log("Superadmin user already exists");
		}
	} catch (error) {
		console.error("Migration or user creation failed:", error);
		process.exit(1);
	} finally {
		await pool.close();
	}
}

await migrate();
