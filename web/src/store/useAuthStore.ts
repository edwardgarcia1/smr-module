import { create } from "zustand";
import { api } from "../services/api";

export interface User {
	id: string;
	username: string;
	name: string;
	role: string;
}

interface AuthState {
	user: User | null;
	isLoading: boolean;
	login: (user: User) => void;
	logout: () => Promise<void>;
	checkAuth: () => Promise<void>;
	setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
	user: null,
	isLoading: true,
	login: (user) => {
		set({ user: user, isLoading: false });
	},
	logout: async () => {
		try {
			await api.logout();
		} catch {
			// Ignore error during logout
		}
		set({ user: null, isLoading: false });
	},
	checkAuth: async () => {
		set({ isLoading: true });
		try {
			const user = await api.apiRequest<User>("/auth/me", { method: "POST" });
			set({ user, isLoading: false });
		} catch {
			set({ user: null, isLoading: false });
		}
	},
	setLoading: (loading) => {
		set({ isLoading: loading });
	},
}));
