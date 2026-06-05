import sql from "mssql";
import { getTenant } from "./tenants";

/**
 * In-memory map of tenant key → live ConnectionPool.
 * Pools are created lazily on first access and cached until idle-evicted.
 */
class TenantPoolRegistry {
	private pools = new Map<string, sql.ConnectionPool>();
	private idleTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private static readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

	async getPool(tenantKey: string): Promise<sql.ConnectionPool> {
		const existing = this.pools.get(tenantKey);
		if (existing?.connected) {
			this.refreshIdleTimer(tenantKey);
			return existing;
		}

		// If there's a stale pool, close it
		if (existing) {
			await existing.close().catch(() => {});
			this.pools.delete(tenantKey);
		}

		const tenant = getTenant(tenantKey);
		if (!tenant) throw new Error(`Unknown tenant: ${tenantKey}`);

		const config: sql.config = {
			server: tenant.host,
			port: tenant.port,
			user: tenant.user,
			password: tenant.password,
			database: tenant.database,
			options: {
				encrypt: false,
				trustServerCertificate: true,
				connectTimeout: 30_000,
				requestTimeout: 180_000,
				cancelTimeout: 5_000,
			},
			pool: {
				max: 10,
				min: 2,
				idleTimeoutMillis: 30_000,
				acquireTimeoutMillis: 30_000,
				createTimeoutMillis: 30_000,
				destroyTimeoutMillis: 10_000,
				reapIntervalMillis: 10_000,
				createRetryIntervalMillis: 2_000,
			},
		};

		const pool = new sql.ConnectionPool(config);
		pool.on("error", (err) => {
			console.error(`[Pool] Error on tenant ${tenantKey}:`, err.message);
			this.pools.delete(tenantKey);
		});

		await pool.connect();
		console.log(
			`[Pool] Connected tenant=${tenantKey} ${tenant.host}/${tenant.database}`,
		);
		this.pools.set(tenantKey, pool);
		this.refreshIdleTimer(tenantKey);
		return pool;
	}

	async closeTenant(tenantKey: string): Promise<void> {
		this.clearIdleTimer(tenantKey);
		const pool = this.pools.get(tenantKey);
		if (pool) {
			await pool.close().catch(() => {});
			this.pools.delete(tenantKey);
		}
	}

	async closeAll(): Promise<void> {
		const keys = Array.from(this.pools.keys());
		await Promise.all(keys.map((k) => this.closeTenant(k)));
	}

	private refreshIdleTimer(tenantKey: string): void {
		this.clearIdleTimer(tenantKey);
		const timer = setTimeout(
			() => this.closeTenant(tenantKey),
			TenantPoolRegistry.IDLE_TIMEOUT_MS,
		);
		timer.unref();
		this.idleTimers.set(tenantKey, timer);
	}

	private clearIdleTimer(tenantKey: string): void {
		const timer = this.idleTimers.get(tenantKey);
		if (timer) {
			clearTimeout(timer);
			this.idleTimers.delete(tenantKey);
		}
	}
}

export const tenantPools = new TenantPoolRegistry();
