import React, { useEffect, useState } from "react";
import {
	Box,
	Card,
	CardHeader,
	CardContent,
	Avatar,
	Typography,
	Button,
	Divider,
	Skeleton,
	Alert,
} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import AssignmentIcon from "@mui/icons-material/Assignment";
import InventoryIcon from "@mui/icons-material/Inventory";
import ShoppingBasketIcon from "@mui/icons-material/ShoppingBasket";
import { useAuthStore } from "../store/useAuthStore";
import { Link } from "react-router-dom";
import apiRequest from "../services/api";

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

	const dashboardCards = data
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

	const quickStatsData = data
		? [
				{ label: "Active Suppliers", value: fmtNumber(data.totalPrincipals) },
				{
					label: "Inventory Items",
					value: fmtNumber(data.totalInventoryItems),
				},
				{
					label: "Incoming Stock",
					value: fmtNumber(data.totalQtyOnPO),
				},
				{
					label: "Stock Value",
					value: fmtCurrency(data.totalStockValue),
				},
			]
		: [];

	const quickActionsData = [
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
		return (
			<Box sx={{ width: "100%" }}>
				<Skeleton variant="text" width={320} height={40} sx={{ mb: 3 }} />
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: {
							xs: "1fr",
							md: "repeat(2, 1fr)",
							xl: "repeat(3, 1fr)",
						},
						gap: 2,
						mb: 3,
					}}
				>
					{[1, 2, 3, 4].map((i) => (
						<Card key={i} sx={{ borderRadius: 3 }}>
							<CardHeader
								avatar={
									<Skeleton
										variant="rectangular"
										width={48}
										height={48}
										sx={{ borderRadius: 2 }}
									/>
								}
								title={<Skeleton variant="text" width="60%" />}
							/>
							<CardContent>
								<Skeleton variant="text" width="40%" height={48} />
								<Skeleton variant="text" width="70%" />
							</CardContent>
						</Card>
					))}
				</Box>
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: { xs: "1fr", md: "7fr 3fr" },
						gap: 2,
					}}
				>
					<Card sx={{ borderRadius: 3, height: 200 }}>
						<Skeleton variant="rectangular" sx={{ height: "100%", borderRadius: 3 }} />
					</Card>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
						<Card sx={{ borderRadius: 3, height: 120 }}>
							<Skeleton variant="rectangular" sx={{ height: "100%", borderRadius: 3 }} />
						</Card>
						<Card sx={{ borderRadius: 3, height: 120 }}>
							<Skeleton variant="rectangular" sx={{ height: "100%", borderRadius: 3 }} />
						</Card>
					</Box>
				</Box>
			</Box>
		);
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

			{/* Dashboard Cards Row */}
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: {
						xs: "1fr",
						sm: "repeat(1, 1fr)",
						md: "repeat(2, 1fr)",
						lg: "repeat(2, 1fr)",
						xl: "repeat(3, 1fr)",
					},
					gap: 2,
					width: "100%",
					mb: 3,
				}}
			>
				{dashboardCards.map((card) => (
					<Link key={card.id} to={card.path} style={{ textDecoration: "none" }}>
						<Card
							sx={{
								height: "100%",
								display: "flex",
								flexDirection: "column",
								borderRadius: 3,
								cursor: "pointer",
								"&:hover": {
									boxShadow: 6,
									transform: "translateY(-2px)",
									transition: "all 0.2s ease-in-out",
								},
							}}
						>
							<CardHeader
								avatar={
									<Avatar
										sx={{
											bgcolor: card.color,
											width: 48,
											height: 48,
											fontSize: "1.5rem",
											borderRadius: 2,
										}}
									>
										{card.icon}
									</Avatar>
								}
								title={
									<Typography
										variant="h6"
										component="div"
										sx={{ fontSize: "1rem" }}
									>
										{card.title}
									</Typography>
								}
								sx={{ pb: 0 }}
							/>
							<CardContent sx={{ pt: 1, flexGrow: 1 }}>
								<Box sx={{ mt: 1 }}>
									<Typography
										variant="h4"
										sx={{ fontWeight: "bold", color: card.color, mb: 0.5 }}
									>
										{card.value}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										{card.subtitle}
									</Typography>
								</Box>
							</CardContent>
						</Card>
					</Link>
				))}
			</Box>

			{/* Bottom Section Row: 70% + 30% split */}
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "1fr", md: "7fr 3fr" },
					gap: 2,
					width: "100%",
				}}
			>
				{/* Left: Principals Overview (70%) */}
				<Card sx={{ borderRadius: 3, height: "100%" }}>
					<CardHeader
						title="Principals Overview"
						action={
							<Button
								size="small"
								component={Link}
								to="/principals"
								sx={{ textTransform: "none" }}
							>
								View All
							</Button>
						}
						sx={{ pb: 0 }}
					/>
					<CardContent sx={{ pt: 1 }}>
						{data &&
							data.itemsPerPrincipal.slice(0, 8).map((principal, index) => (
								<Box key={principal.classID}>
									{index > 0 && <Divider sx={{ my: 1.5 }} />}
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											gap: 2,
										}}
									>
										<Avatar
											sx={{
												bgcolor: "primary.main",
												width: 40,
												height: 40,
												fontSize: "0.8rem",
												fontWeight: "bold",
												borderRadius: 2,
											}}
										>
											{principal.classID.slice(0, 2)}
										</Avatar>
										<Box sx={{ flexGrow: 1 }}>
											<Typography
												variant="body1"
												sx={{ fontWeight: "medium" }}
											>
												{principal.description || principal.classID}
											</Typography>
											<Typography
												variant="body2"
												color="text.secondary"
											>
												{principal.itemCount} item
												{principal.itemCount !== 1 ? "s" : ""}
											</Typography>
										</Box>
										<Typography
											variant="body2"
											sx={{
												fontWeight: "bold",
												color: "primary.main",
												minWidth: 32,
												textAlign: "right",
											}}
										>
											{principal.itemCount}
										</Typography>
									</Box>
								</Box>
							))}
						{data && data.itemsPerPrincipal.length === 0 && (
							<Typography
								variant="body2"
								color="text.secondary"
								sx={{ py: 2, textAlign: "center" }}
							>
								No principals found
							</Typography>
						)}
					</CardContent>
				</Card>

				{/* Right: 30% Split Vertically */}
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
					{/* Quick Stats */}
					<Card sx={{ borderRadius: 3, flexGrow: 1 }}>
						<CardHeader title="Quick Stats" sx={{ pb: 0 }} />
						<CardContent sx={{ pt: 1 }}>
							<Box
								sx={{
									display: "grid",
									gridTemplateColumns: "1fr 1fr",
									gap: 1,
								}}
							>
								{quickStatsData.map((stat, index) => (
									<Box key={index} sx={{ textAlign: "center", py: 1 }}>
										<Typography
											variant="h6"
											sx={{ fontWeight: "bold", color: "primary.main" }}
										>
											{stat.value}
										</Typography>
										<Typography variant="caption" color="text.secondary">
											{stat.label}
										</Typography>
									</Box>
								))}
							</Box>
						</CardContent>
					</Card>

					{/* Quick Actions */}
					<Card sx={{ borderRadius: 3, flexGrow: 1 }}>
						<CardHeader title="Quick Actions" sx={{ pb: 0 }} />
						<CardContent sx={{ pt: 1 }}>
							<Box
								sx={{
									display: "flex",
									flexDirection: "column",
									gap: 1,
								}}
							>
								{quickActionsData.map((action, index) => (
									<Button
										key={index}
										component={Link}
										to={action.path}
										variant="outlined"
										startIcon={action.icon}
										sx={{
											justifyContent: "flex-start",
											textAlign: "left",
											px: 2,
											py: 1,
											textTransform: "none",
											borderColor: "grey.300",
											color: "text.primary",
											"&:hover": {
												borderColor: "primary.main",
												bgcolor: "action.hover",
											},
										}}
									>
										{action.label}
									</Button>
								))}
							</Box>
						</CardContent>
					</Card>
				</Box>
			</Box>
		</Box>
	);
};

export default Home;
