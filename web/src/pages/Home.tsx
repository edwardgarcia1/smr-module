import React, { useEffect, useState } from "react";
import {
	Box,
	Typography,
	Alert,
} from "@mui/material";
import { useAuthStore } from "../store/useAuthStore";
import apiRequest from "../services/api";
import DashboardCards from "../components/home/DashboardCards";
import type { DashboardCardData } from "../components/home/DashboardCards";
import PrincipalsOverview from "../components/home/PrincipalsOverview";
import QuickStats from "../components/home/QuickStats";
import QuickActions from "../components/home/QuickActions";
import DashboardLoadingSkeleton from "../components/home/DashboardLoadingSkeleton";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import InventoryIcon from "@mui/icons-material/Inventory";
import ShoppingBasketIcon from "@mui/icons-material/ShoppingBasket";

// ─── API response shape ───────────────────────────────────────────────

interface DashboardSummary {
	totalInventoryItems: number;
	totalPrincipals: number;
	itemsWithoutPrice: number;
	itemsZeroAvailable: number;
	totalQtyOnPO: number;
	totalStockValue: number;
	totalUsers: number;
	itemsPerPrincipal: Array<{
		classID: string;
		description: string;
		itemCount: number;
	}>;
	minStockSettingDistribution: {
		custom: number;
		principal: number;
		default: number;
	};
}

// ─── Helpers ──────────────────────────────────────────────────────────

function fmtNumber(n: number): string {
	return n.toLocaleString(undefined, {
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	});
}

function fmtCurrency(n: number): string {
	return n.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

// ─── Component ────────────────────────────────────────────────────────

const Home: React.FC = () => {
	const user = useAuthStore((state) => state.user);
	const [data, setData] = useState<DashboardSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const abort = new AbortController();

		const fetchData = async () => {
			setLoading(true);
			setError(null);
			try {
				const result = await apiRequest<DashboardSummary>(
					"/dashboard/summary",
					{ signal: abort.signal },
				);
				setData(result);
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === "AbortError") return;
				setError(
					err instanceof Error
						? err.message
						: "Failed to load dashboard data",
				);
			} finally {
				if (!abort.signal.aborted) setLoading(false);
			}
		};

		fetchData();
		return () => abort.abort();
	}, []);

	// ── Derive display data ──────────────────────────────────────────

	const dashboardCards: DashboardCardData[] = data
		? [
				{
					id: 1,
					title: "Total Inventory",
					value: fmtNumber(data.totalInventoryItems),
					subtitle: "Active inventory items",
					icon: <WarehouseIcon />,
					color: "success.main",
					path: "/inventory-items",
				},
				{
					id: 2,
					title: "Active Principals",
					value: fmtNumber(data.totalPrincipals),
					subtitle: "Registered suppliers",
					icon: <AssignmentIcon />,
					color: "info.main",
					path: "/principals",
				},
				{
					id: 3,
					title: "Items Without Price",
					value: fmtNumber(data.itemsWithoutPrice),
					subtitle: "Missing current price",
					icon: <ShoppingCartIcon />,
					color: "error.main",
					path: "/prices",
				},
				{
					id: 4,
					title: "Zero Available",
					value: fmtNumber(data.itemsZeroAvailable),
					subtitle: "Items out of stock",
					icon: <Inventory2Icon />,
					color: "warning.main",
					path: "/inventory-items",
				},
			]
		: [];

	const quickStats = data
		? [
				{ label: "Active Suppliers", value: fmtNumber(data.totalPrincipals) },
				{
					label: "Inventory Items",
					value: fmtNumber(data.totalInventoryItems),
				},
				{ label: "Incoming Stock", value: fmtNumber(data.totalQtyOnPO) },
				{ label: "Stock Value", value: fmtCurrency(data.totalStockValue) },
			]
		: [];

	const quickActions = [
		{
			label: "Open SMR View",
			path: "/purchasing-requirements",
			icon: <AssignmentIcon />,
		},
		{
			label: "Manage Inventory",
			path: "/inventory-items",
			icon: <InventoryIcon />,
		},
		{
			label: "Purchase Orders",
			path: "/purchase-orders",
			icon: <ShoppingBasketIcon />,
		},
	];

	// ── Loading skeleton ─────────────────────────────────────────────

	if (loading) {
		return <DashboardLoadingSkeleton />;
	}

	// ── Error state ──────────────────────────────────────────────────

	if (error) {
		return (
			<Box sx={{ width: "100%" }}>
				<Typography variant="h5" component="h1" sx={{ mb: 3 }}>
					Welcome to the dashboard, {user?.name}!
				</Typography>
				<Alert severity="error" sx={{ mb: 2 }}>
					{error}
				</Alert>
			</Box>
		);
	}

	// ── Main render ──────────────────────────────────────────────────

	return (
		<Box sx={{ width: "100%" }}>
			<Typography variant="h5" component="h1" sx={{ mb: 3 }}>
				Welcome to the dashboard, {user?.name}!
			</Typography>

			<DashboardCards cards={dashboardCards} />

			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "1fr", md: "7fr 3fr" },
					gap: 2,
					width: "100%",
				}}
			>
				<PrincipalsOverview principals={data?.itemsPerPrincipal ?? []} />

				<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
					<QuickStats stats={quickStats} />
					<QuickActions actions={quickActions} />
				</Box>
			</Box>
		</Box>
	);
};

export default Home;
