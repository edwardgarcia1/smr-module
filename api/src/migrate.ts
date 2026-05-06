import sql from "mssql";
import { CREATE_USERS_TABLE_SQL } from "./modules/users/schema";

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

    // Seed superadmin if not exists
    const username = process.env.SUPERADMIN_USERNAME || "superadmin";
    const checkResult = await pool
      .request()
      .input("username", username)
      .query("SELECT COUNT(*) AS cnt FROM SMR_Users WHERE username = @username");

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
        .input("role", "superadmin")
        .query(`
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
