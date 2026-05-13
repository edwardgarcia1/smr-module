const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const API_ENDPOINT = "/api";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface RequestOptions extends Omit<RequestInit, "body" | "method"> {
	body?: Record<string, unknown> | FormData;
	method?: HttpMethod;
	isRefresh?: boolean;
}

// Shared pending refresh promise — deduplicates concurrent 401 refresh attempts
let refreshPromise: Promise<void> | null = null;

const refreshToken = async (): Promise<void> => {
	if (!refreshPromise) {
		refreshPromise = apiRequest("/auth/refresh", { method: "POST", isRefresh: true })
			.finally(() => {
				refreshPromise = null;
			});
	}
	return refreshPromise;
};

const apiRequest = async <T>(
	endpoint: string,
	options: RequestOptions = {},
): Promise<T> => {
	const { body, method = "GET", isRefresh = false, ...fetchOptions } = options;

	const url = `${API_BASE_URL}${API_ENDPOINT + endpoint}`;

	const config: RequestInit = {
		...fetchOptions,
		method,
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			"x-client-type": "web",
			...fetchOptions.headers,
		},
	};

	if (body) {
		if (body instanceof FormData) {
			delete (config.headers as Record<string, string>)["Content-Type"];
			config.body = body;
		} else {
			config.body = JSON.stringify(body);
		}
	}

	let response = await fetch(url, config);

	if (response.status === 401 && !isRefresh) {
		try {
			await refreshToken();
			response = await fetch(url, config);
		} catch {
			// Refresh failed — clear user state so ProtectedRoute redirects to /login
			const { useAuthStore } = await import("../store/useAuthStore");
			useAuthStore.getState().logout();
			throw new Error("Session expired. Please login again.");
		}
	}

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			errorData.error || errorData.message || `HTTP error! status: ${response.status}`,
		);
	}

	return response.json();
};

const logout = async (): Promise<void> => {
	await apiRequest("/auth/logout", { method: "POST" });
};

export const api = {
	apiRequest,
	logout,
};

export default api.apiRequest;

// ─── Proactive token refresh ──────────────────────────────────────────
// Cookies expire at 15 min. Refresh every 12 min to avoid hitting 401s.
const REFRESH_INTERVAL = 12 * 60 * 1000;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Start recurring proactive refresh cycle. Safe to call multiple times. */
export function scheduleTokenRefresh(): void {
	cancelTokenRefresh();
	refreshTimer = setTimeout(async () => {
		try {
			await apiRequest("/auth/refresh", { method: "POST", isRefresh: true });
			scheduleTokenRefresh(); // Recur
		} catch {
			// Silent — reactive 401 handler in apiRequest deals with failures
		}
	}, REFRESH_INTERVAL);
}

/** Cancel any pending proactive refresh. Call on logout. */
export function cancelTokenRefresh(): void {
	if (refreshTimer !== null) {
		clearTimeout(refreshTimer);
		refreshTimer = null;
	}
}
