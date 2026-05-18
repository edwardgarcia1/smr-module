import React, { useEffect, Suspense, lazy } from "react";
import {
	BrowserRouter as Router,
	Routes,
	Route,
	Navigate,
	Outlet,
	useLocation,
} from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import { AbilityProvider } from "./config/AbilityProvider";
import AppLayout from "./layouts/AppLayout";
import type { BreadcrumbItem } from "./layouts/AppHeader";
import Loading from "./pages/Loading";
import SplashScreen from "./pages/SplashScreen";
import { LinearProgress, Box } from "@mui/material";

// 1. Lazy Load Pages for better performance (Code Splitting)
	const Login = lazy(() => import("./pages/Login"));
	const Register = lazy(() => import("./pages/Register"));
	const Home = lazy(() => import("./pages/Home"));
	const Users = lazy(() => import("./pages/Users"));
	const InventoryItems = lazy(() => import("./pages/InventoryItems"));
	const Principals = lazy(() => import("./pages/Principals"));
	const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
	const Settings = lazy(() => import("./pages/Settings"));
	const Profile = lazy(() => import("./pages/Profile"));
	const PurchasingRequirements = lazy(() => import("./pages/PurchasingRequirements"));
	const Prices = lazy(() => import("./pages/Prices"));
	const SalesOrders = lazy(() => import("./pages/SalesOrders"));

// 2. Map root paths to display labels for breadcrumb generation
const ROOT_LABEL_MAP: Record<string, string> = {
	"/": "Dashboard",
	"/users": "Users",
	"/inventory-items": "Inventory Items",
	"/principals": "Principals",
	"/purchase-orders": "Purchase Orders",
	"/settings": "Settings",
	"/profile": "Profile",
	"/purchasing-requirements": "Purchasing Requirements",
	"/prices": "Prices",
	"/sales-orders": "Sales Orders",
};

/**
 * Build breadcrumbs from the current pathname.
 * The first segment is resolved via ROOT_LABEL_MAP; subsequent segments
 * are displayed as-is (IDs, action names, etc.) for future sub-page support.
 */
function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
	const segments = pathname.split("/").filter(Boolean);
	if (segments.length === 0) {
		return [{ label: "Dashboard" }];
	}

	const crumbs: BreadcrumbItem[] = [];

	segments.forEach((segment, index) => {
		const path = "/" + segments.slice(0, index + 1).join("/");
		const isLast = index === segments.length - 1;

		// First segment: resolve via map
		if (index === 0) {
			crumbs.push({
				label: ROOT_LABEL_MAP[path] || segment,
				...(isLast ? {} : { href: path }),
			});
		} else {
			// Nested segment: use the raw segment as label
			const label = segment
				.split("-")
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
				.join(" ");
			crumbs.push({
				label,
				...(isLast ? {} : { href: path }),
			});
		}
	});

	return crumbs;
}

const AuthenticatedLayout: React.FC = () => {
	const location = useLocation();
	const breadcrumbs = buildBreadcrumbs(location.pathname);

	return (
		<AppLayout breadcrumbs={breadcrumbs}>
			<Outlet />
		</AppLayout>
	);
};

// 3. Reusable Protected Route Component
// Handles the loading state locally and redirects if unauthenticated
const ProtectedRoute: React.FC = () => {
	const { user, isLoading } = useAuthStore();

	if (isLoading) {
		return <Loading />;
	}

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	return <Outlet />;
};

// 4. Reusable Guest Route Component
// Redirects authenticated users away from Login/Register
const GuestRoute: React.FC = () => {
	const { user, isLoading } = useAuthStore();

	if (isLoading) {
		return (
			<Box
				sx={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					height: "100vh",
				}}
			>
				<LinearProgress aria-label="Loading…" />
			</Box>
		);
	}

	if (user) {
		return <Navigate to="/" replace />;
	}

	return <Outlet />;
};

const GuestSuspense: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => <Suspense fallback={null}>{children}</Suspense>;

const AppSuspense: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<Suspense fallback={null}>{children}</Suspense>
);

const AppRoutes: React.FC = () => {
	return (
		<Routes>
			{/* Public/Guest Routes */}
			<Route element={<GuestRoute />}>
				<Route
					path="/login"
					element={
						<GuestSuspense>
							<Login />
						</GuestSuspense>
					}
				/>
				<Route
					path="/register"
					element={
						<GuestSuspense>
							<Register />
						</GuestSuspense>
					}
				/>
			</Route>

			{/* Protected Routes */}
			<Route element={<ProtectedRoute />}>
				<Route element={<AuthenticatedLayout />}>
					<Route
						path="/"
						element={
							<AppSuspense>
								<Home />
							</AppSuspense>
						}
					/>
				<Route
					path="/users"
					element={
						<AppSuspense>
							<Users />
						</AppSuspense>
					}
				/>
				<Route
					path="/inventory-items"
					element={
						<AppSuspense>
							<InventoryItems />
						</AppSuspense>
					}
				/>
				<Route
					path="/principals"
					element={
						<AppSuspense>
							<Principals />
						</AppSuspense>
					}
				/>
				<Route
					path="/purchase-orders"
					element={
						<AppSuspense>
							<PurchaseOrders />
						</AppSuspense>
					}
				/>
				<Route
					path="/purchasing-requirements"
					element={
						<AppSuspense>
							<PurchasingRequirements />
						</AppSuspense>
					}
				/>
				<Route
					path="/prices"
					element={
						<AppSuspense>
							<Prices />
						</AppSuspense>
					}
				/>
				<Route
					path="/sales-orders"
					element={
						<AppSuspense>
							<SalesOrders />
						</AppSuspense>
					}
				/>
				<Route
					path="/settings"
					element={
						<AppSuspense>
							<Settings />
						</AppSuspense>
					}
				/>
					<Route
						path="/profile"
						element={
							<AppSuspense>
								<Profile />
							</AppSuspense>
						}
					/>
				</Route>
			</Route>

			{/* Catch-all */}
			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	);
};

function App() {
	const checkAuth = useAuthStore((state) => state.checkAuth);
	const isInitialAuth = useAuthStore((state) => state.isInitialAuth);

	useEffect(() => {
		checkAuth();
	}, [checkAuth]);

	// Branded splash screen during the very first auth check on app mount
	if (isInitialAuth) {
		return <SplashScreen />;
	}

	return (
		<AbilityProvider>
			<Router>
				<AppRoutes />
			</Router>
		</AbilityProvider>
	);
}

export default App;
