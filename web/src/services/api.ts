const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const API_ENDPOINT = "/api";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface RequestOptions extends Omit<RequestInit, "body" | "method"> {
	body?: Record<string, unknown> | FormData;
	method?: HttpMethod;
	isRefresh?: boolean;
}

const refreshToken = async (): Promise<void> => {
	await apiRequest("/auth/refresh", { method: "POST", isRefresh: true });
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
			// If refresh fails, logout or handle as needed
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
