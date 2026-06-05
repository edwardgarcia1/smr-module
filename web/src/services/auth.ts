import { api } from "./api";
import type { User } from "../store/useAuthStore";

interface LoginResponse {
	user: User;
	message: string;
}

interface RegisterResponse {
	message: string;
	userId: string;
}

/**
 * Typed auth service — wraps api.apiRequest calls for auth endpoints.
 * Pages should use this instead of calling api.apiRequest directly.
 */
export const authService = {
	login: (username: string, password: string, tenant?: string) =>
		api.apiRequest<LoginResponse>("/auth/login", {
			method: "POST",
			body: { username, password, ...(tenant ? { tenant } : {}) },
		}),

	register: (username: string, password: string, name: string, signal?: AbortSignal) =>
		api.apiRequest<RegisterResponse>("/auth/register", {
			method: "POST",
			body: { username, password, name },
			signal,
		}),

	logout: () => api.logout(),

	me: () => api.apiRequest<User>("/auth/me", { method: "POST" }),
};
