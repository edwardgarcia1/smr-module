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
import Loading from "./pages/Loading";
import { LinearProgress, Box } from "@mui/material";

// 1. Lazy Load Pages for better performance (Code Splitting)
	const Login = lazy(() => import("./pages/Login"));
	const Register = lazy(() => import("./pages/Register"));
	const Home = lazy(() => import("./pages/Home"));
	const Users = lazy(() => import("./pages/Users"));
	const InventoryItems = lazy(() => import("./pages/InventoryItems"));
	const Suppliers = lazy(() => import("./pages/Suppliers"));
	const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
	const Settings = lazy(() => import("./pages/Settings"));
	const Profile = lazy(() => import("./pages/Profile"));
	const PurchasingRequirements = lazy(() => import("./pages/PurchasingRequirements"));
	const Prices = lazy(() => import("./pages/Prices"));

// 2. Mapping pathnames to tabs keeps logic data-driven and cleaner
const TAB_MAP: Record<string, string> = {
	"/": "Dashboard",
	"/users": "Users",
	"/inventory-items": "Inventory Items",
	"/suppliers": "Suppliers",
	"/purchase-orders": "Purchase Orders",
	"/settings": "Settings",
	"/profile": "Profile",
	"/purchasing-requirements": "Purchasing Requirements",
	"/prices": "Prices",
};

const AuthenticatedLayout: React.FC = () => {
	const location = useLocation();
	// Optimization: Use object lookup instead of switch statement
	const currentTab = TAB_MAP[location.pathname] || "";

	return (
		<AppLayout currentTab={currentTab}>
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
					path="/suppliers"
					element={
						<AppSuspense>
							<Suppliers />
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

	useEffect(() => {
		checkAuth();
	}, [checkAuth]);

	return (
		<AbilityProvider>
			<Router>
				<AppRoutes />
			</Router>
		</AbilityProvider>
	);
}

export default App;
