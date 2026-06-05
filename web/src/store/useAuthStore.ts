import { create } from "zustand";
import { authService } from "../services/auth";

export interface User {
	id: string;
	username: string;
	name: string;
	tenant?: string;
}

export interface TenantOption {
	key: string;
	displayName: string;
}

interface AuthState {
	user: User | null;
	isLoading: boolean;
	/** True only during the very first checkAuth() call on app mount */
	isInitialAuth: boolean;
	tenant: string | null;
	availableTenants: TenantOption[];
	login: (user: User) => void;
	logout: () => Promise<void>;
	checkAuth: () => Promise<void>;
	setLoading: (loading: boolean) => void;
	setUser: (user: User | null) => void;
	setTenant: (tenant: string | null) => void;
	setAvailableTenants: (tenants: TenantOption[]) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
	user: null,
	isLoading: true,
	isInitialAuth: true,
	tenant: localStorage.getItem("smr-tenant"),
	availableTenants: [],
	login: (user) => {
		localStorage.setItem("smr-tenant", user.tenant ?? "default");
		set({ user, tenant: user.tenant ?? "default", isLoading: false });
	},
	logout: async () => {
		try {
			await authService.logout();
		} catch {
			// Ignore error during logout
		}
		localStorage.removeItem("smr-tenant");
		set({ user: null, tenant: null, isLoading: false });
	},
	checkAuth: async () => {
		try {
			const user = await authService.me();
			const tenant = user?.tenant ?? localStorage.getItem("smr-tenant");
			set({ user, tenant, isLoading: false });
		} catch {
			localStorage.removeItem("smr-tenant");
			set({ user: null, tenant: null, isLoading: false });
		} finally {
			set({ isInitialAuth: false });
		}
	},
	setLoading: (loading) => {
		set({ isLoading: loading });
	},
	setUser: (user) => {
		set({ user });
	},
	setTenant: (tenant) => {
		if (tenant) localStorage.setItem("smr-tenant", tenant);
		else localStorage.removeItem("smr-tenant");
		set({ tenant });
	},
	setAvailableTenants: (tenants) => {
		set({ availableTenants: tenants });
	},
}));
