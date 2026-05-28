import sql from "mssql";

let pool: sql.ConnectionPool | null = null;

function createConfig(): sql.config {
  return {
    server: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 1433,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    options: {
      encrypt: false, // MSSQL 2008 does not support encryption by default
      trustServerCertificate: true,
      connectTimeout: 30_000, // 30s — abort if SQL Server unreachable
      requestTimeout: 180_000, // 3 min — accommodates heavy reporting queries
      cancelTimeout: 5_000, // 5s — cleanup dead queries
    },
    pool: {
      max: 10,
      min: 2,
      idleTimeoutMillis: 30_000, // 30s idle → release back to OS
      acquireTimeoutMillis: 30_000, // 30s to get a conn from pool
      createTimeoutMillis: 30_000, // 30s to open new TCP conn
      destroyTimeoutMillis: 10_000, // 10s to tear down dead conn
      reapIntervalMillis: 10_000, // check every 10s for idle eviction
      createRetryIntervalMillis: 2_000, // retry failed create every 2s
    },
  };
}

/** Destroy and null the pool — next getDb() creates a fresh one. */
async function destroyPool(): Promise<void> {
  if (pool) {
    try {
      await pool.close();
    } catch {
      // ignore close errors on dead pool
    }
    pool = null;
  }
}

export async function getDb(): Promise<sql.ConnectionPool> {
  if (pool?.connected) {
    // Health check: verify the pool is actually alive (prevents returning
    // a pool whose underlying TCP connections have silently dropped).
    try {
      await pool.request().query("SELECT 1");
      return pool;
    } catch {
      console.warn(
        "[DB] Pool health check failed, reconnecting:",
        (pool as any)?._pool?.length ?? "unknown",
      );
      // Fall through to reconnect
    }
  }

  await destroyPool();

  pool = new sql.ConnectionPool(createConfig());

  // Recreate pool on error so next call retries fresh
  pool.on("error", (err: Error) => {
    console.error("[DB] Pool error, will recreate on next call:", err.message);
    pool = null;
  });

  await pool.connect();
  console.log("[DB] Connected to MSSQL:", process.env.DB_HOST);
  return pool;
}

/**
 * Execute a DB query with automatic retry on connection-loss.
 *
 * If the underlying TCP connection dies mid-query (e.g. SQL Server idle
 * timeout, network blip), the pool is destroyed and recreated, then the
 * query runs one more time.
 *
 * Usage:
 *   const rows = await withDb(pool => pool.request().query("SELECT ..."));
 */
export async function withDb<T>(
  fn: (pool: sql.ConnectionPool) => Promise<T>,
): Promise<T> {
  try {
    return await fn(await getDb());
  } catch (err) {
    const errMsg = (err as Error)?.message ?? "";
    // tedius throws "unexpected end of data" when TCP stream dies
    const isConnectionLoss =
      errMsg.includes("unexpected end of data") ||
      errMsg.includes("end of data") ||
      errMsg.includes("ECONNRESET") ||
      errMsg.includes("socket hang up") ||
      errMsg.includes("read ECONNRESET") ||
      errMsg.includes("Connection lost");

    if (!isConnectionLoss) {
      throw err;
    }

    console.warn(
      "[DB] Connection lost, retrying once:",
      (err as Error).message,
    );
    await destroyPool();
    return await fn(await getDb());
  }
}

export default sql;
