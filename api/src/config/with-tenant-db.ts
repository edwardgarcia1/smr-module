import { tenantPools } from "./tenant-pool";
import type sql from "mssql";

/**
 * Execute a callback against a tenant-specific pool.
 * Retries once on connection loss.
 */
export async function withTenantDb<T>(
	tenantKey: string,
	fn: (pool: sql.ConnectionPool) => Promise<T>,
): Promise<T> {
	try {
		const pool = await tenantPools.getPool(tenantKey);
		return await fn(pool);
	} catch (err) {
		const msg = (err as Error)?.message ?? "";
		const isLoss =
			msg.includes("unexpected end of data") ||
			msg.includes("ECONNRESET") ||
			msg.includes("socket hang up") ||
			msg.includes("Connection lost");

		if (!isLoss) throw err;

		console.warn(`[DB] Tenant ${tenantKey} connection lost, retrying once`);
		await tenantPools.closeTenant(tenantKey);
		const pool = await tenantPools.getPool(tenantKey);
		return await fn(pool);
	}
}
