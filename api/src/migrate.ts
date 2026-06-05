import sql from "mssql";
import { getTenants, getTenant, type TenantConfig } from "./config/tenants";
import { CREATE_USERS_TABLE_SQL } from "./modules/users/user.schema";
import {
	CREATE_PERMISSIONS_TABLE_SQL,
	INSERT_PERMISSION_SQL,
} from "./modules/users/permission.schema";
import { ALL_SUBJECTS } from "./shared/permissions";
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
import { CREATE_PURCHASE_ORDERS_TABLE_SQL } from "./modules/purchase-order/purchase-order.schema";

async function migrateOne(tenant: TenantConfig): Promise<void> {
	const config: sql.config = {
		server: tenant.host,
		port: tenant.port,
		user: tenant.user,
		password: tenant.password,
		database: tenant.database,
		options: { encrypt: false, trustServerCertificate: true },
	};

	const pool = await sql.connect(config);
	try {
		console.log(`  Creating tables for ${tenant.key}...`);

		// Create SMR_Users table if it doesn't exist
		await pool.request().query(CREATE_USERS_TABLE_SQL);
		console.log("  SMR_Users table ready");

		// Create SMR_Permissions table if it doesn't exist
		await pool.request().query(CREATE_PERMISSIONS_TABLE_SQL);
		console.log("  SMR_Permissions table ready");

		// Create SMR_ItemPrice table (renamed from SMR_ItemCost)
		await pool.request().query(CREATE_ITEMPRICE_TABLE_SQL);
		console.log("  SMR_ItemPrice table ready");

		// Create SMR_PriceClass table
		await pool.request().query(CREATE_PRICECLASS_TABLE_SQL);
		console.log("  SMR_PriceClass table ready");

		// Create SMR_MinStockSetting table
		await pool.request().query(CREATE_MIN_STOCK_SETTING_TABLE_SQL);
		console.log("  SMR_MinStockSetting table ready");

		// Create SMR_MinStockItem table
		await pool.request().query(CREATE_MIN_STOCK_ITEM_TABLE_SQL);
		console.log("  SMR_MinStockItem table ready");

		// Create SMR_MinStockPrincipal table
		await pool.request().query(CREATE_MIN_STOCK_PRINCIPAL_TABLE_SQL);
		console.log("  SMR_MinStockPrincipal table ready");

		// Seed default min stock row
		await pool.request().query(SEED_DEFAULT_MIN_STOCK_SQL);
		console.log("  Default min stock row seeded");

		// Create SMR_MinStockCategory table
		await pool.request().query(CREATE_MIN_STOCK_CATEGORY_TABLE_SQL);
		console.log("  SMR_MinStockCategory table ready");

		// Seed min stock categories
		await pool.request().query(SEED_MIN_STOCK_CATEGORIES_SQL);
		console.log("  Min stock categories seeded");

		// Create SMR_PurchaseOrders table
		await pool.request().query(CREATE_PURCHASE_ORDERS_TABLE_SQL);
		console.log("  SMR_PurchaseOrders table ready");

		// Seed superadmin if not exists
		await seedSuperadmin(pool, tenant.key);
	} finally {
		await pool.close();
	}
}

async function seedSuperadmin(
	pool: sql.ConnectionPool,
	tenantKey: string,
): Promise<void> {
	const username = process.env.SUPERADMIN_USERNAME || "superadmin";
	const checkResult = await pool
		.request()
		.input("username", username)
		.query(
			"SELECT COUNT(*) AS cnt FROM SMR_Users WHERE username = @username",
		);

	const count = checkResult.recordset[0]?.cnt ?? 0;

	if (count === 0) {
		console.log(`  Creating superadmin user for ${tenantKey}...`);
		const hashedPassword = await Bun.password.hash(
			process.env.SUPERADMIN_PASSWORD || "Passw0rd",
			{ algorithm: "bcrypt", cost: 10 },
		);

		const result = await pool
			.request()
			.input("username", username)
			.input("password", hashedPassword)
			.input("name", process.env.SUPERADMIN_NAME || "Super Admin")
			.query(`
				INSERT INTO SMR_Users (username, password, name)
				OUTPUT INSERTED.id
				VALUES (@username, @password, @name)
			`);

		const createdUserId = result.recordset[0]?.id;

		// Seed manage permissions for all canonical subjects.
		// Deduplicate by normalized form because SQL Server's default
		// collation is case-insensitive — "Prices" and "prices" would
		// collide on the UNIQUE constraint.
		if (createdUserId) {
			const seen = new Set<string>();
			for (const subject of ALL_SUBJECTS) {
				const norm = subject.toLowerCase().replace(/[^a-z0-9]/g, "");
				if (seen.has(norm)) continue;
				seen.add(norm);
				await pool
					.request()
					.input("userId", createdUserId)
					.input("subject", subject)
					.input("action", "manage")
					.query(INSERT_PERMISSION_SQL);
			}
			console.log(`  Superadmin permissions seeded for ${tenantKey}`);
		}

		console.log(`  Superadmin user created for ${tenantKey}`);
	} else {
		console.log(`  Superadmin user already exists for ${tenantKey}`);
	}
}

async function main() {
	const args = process.argv.slice(2);
	const tenantFlag = args.find((a) => a.startsWith("--tenant="));

	if (args.includes("--list")) {
		console.log("\nRegistered tenants:");
		for (const t of getTenants()) {
			console.log(
				`  ${t.key.padEnd(10)} ${t.displayName.padEnd(25)} ${t.host}:${t.port}/${t.database}`,
			);
		}
		process.exit(0);
	}

	let targets: TenantConfig[];

	if (tenantFlag) {
		const key = tenantFlag.split("=")[1] ?? "";
		if (!key) {
			console.error("Usage: --tenant=<key>");
			process.exit(1);
		}
		const t = getTenant(key);
		if (!t) {
			console.error(`Unknown tenant: ${key}`);
			process.exit(1);
		}
		targets = [t];
	} else {
		targets = getTenants();
	}

	if (targets.length === 0) {
		console.log("No tenants configured. Set TENANTS env var or DB_HOST.");
		process.exit(1);
	}

	for (const tenant of targets) {
		console.log(
			`\n═══ Migrating ${tenant.key} (${tenant.host}:${tenant.port}/${tenant.database}) ═══`,
		);
		try {
			await migrateOne(tenant);
			console.log(`✅ ${tenant.key} done\n`);
		} catch (error) {
			console.error(`❌ ${tenant.key} failed:`, error);
			process.exit(1);
		}
	}
}

await main();
