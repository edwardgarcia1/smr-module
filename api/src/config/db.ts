import sql from "mssql";

const config: sql.config = {
  server: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 1433,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  options: {
    encrypt: false, // MSSQL 2008 does not support encryption by default
    trustServerCertificate: true,
  },
};

const pool = new sql.ConnectionPool(config);

export async function getDb(): Promise<sql.ConnectionPool> {
  if (!pool.connected) {
    await pool.connect();
  }
  return pool;
}

export default sql;
