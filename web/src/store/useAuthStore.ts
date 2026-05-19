import { create } from "zustand";
import { authService } from "../services/auth";

export interface User {
	id: string;
	username: string;
	name: string;
	role: string;
}

interface AuthState {
	user: User | null;
	isLoading: boolean;
	/** True only during the very first checkAuth() call on app mount */
	isInitialAuth: boolean;
	login: (user: User) => void;
	logout: () => Promise<void>;
	checkAuth: () => Promise<void>;
	setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
	user: null,
	isLoading: true,
	isInitialAuth: true,
	login: (user) => {
		set({ user, isLoading: false });
	},
	logout: async () => {
		try {
			await authService.logout();
		} catch {
			// Ignore error during logout
		}
		set({ user: null, isLoading: false });
	},
	checkAuth: async () => {
		try {
			const user = await authService.me();
			set({ user, isLoading: false });
		} catch {
			set({ user: null, isLoading: false });
		} finally {
			set({ isInitialAuth: false });
		}
	},
	setLoading: (loading) => {
		set({ isLoading: loading });
	},
}));
