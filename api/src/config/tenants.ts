export interface TenantConfig {
	key: string;
	displayName: string;
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
}

/**
 * Returns the list of all configured tenants.
 *
 * Reads from env var TENANTS (JSON array of keys).
 * Each tenant's details come from TENANT_{KEY}_{PROP} env vars.
 *
 * If TENANTS is not set, falls back to legacy single-tenant mode
 * using the old DB_HOST / DB_NAME / etc. vars — zero behavioral change.
 */
export function getTenants(): TenantConfig[] {
	const raw = process.env.TENANTS;
	if (!raw) {
		// Legacy fallback — single tenant from the old env vars
		if (!process.env.DB_HOST) return [];
		return [
			{
				key: "default",
				displayName: process.env.DB_NAME ?? "Default",
				host: process.env.DB_HOST,
				port: Number(process.env.DB_PORT) || 1433,
				user: process.env.DB_USER || "sa",
				password: process.env.DB_PASSWORD || "",
				database: process.env.DB_NAME || "MLDIAPP",
			},
		];
	}

	let keys: string[];
	try {
		keys = JSON.parse(raw);
	} catch {
		console.error("[Tenants] Failed to parse TENANTS env var:", raw);
		return [];
	}
	return keys.map((k) => {
		const p = `TENANT_${k.toUpperCase()}`;
		return {
			key: k,
			displayName: process.env[`${p}_DISPLAY`] || k,
			host: process.env[`${p}_HOST`] || process.env.DB_HOST!,
			port:
				Number(process.env[`${p}_PORT`]) || Number(process.env.DB_PORT) || 1433,
			user: process.env[`${p}_USER`] || process.env.DB_USER || "sa",
			password: process.env[`${p}_PASSWORD`] || process.env.DB_PASSWORD || "",
			database:
				process.env[`${p}_DATABASE`] || process.env.DB_NAME || "MLDIAPP",
		};
	});
}

export function getTenant(key: string): TenantConfig | undefined {
	return getTenants().find((t) => t.key === key);
}
