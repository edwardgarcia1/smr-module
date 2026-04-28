import React, { useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
	Drawer,
	List,
	ListItemIcon,
	ListItemText,
	Box,
	ListItemButton,
	Typography,
	Divider,
	Accordion,
	AccordionSummary,
	AccordionDetails,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogContentText,
	DialogActions,
	Button,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import SettingsIcon from "@mui/icons-material/Settings";
import PeopleIcon from "@mui/icons-material/People";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AssignmentIcon from "@mui/icons-material/Assignment";
import InventoryIcon from "@mui/icons-material/Inventory";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ShoppingBasketIcon from "@mui/icons-material/ShoppingBasket";
import MoneyIcon from "@mui/icons-material/Money";
import { Can } from "@casl/react";
import { useAbility } from "../config/AbilityProvider";
import { useAuthStore } from "../store/useAuthStore";

interface AppSidebarProps {
	mobileOpen: boolean;
	onToggle: () => void;
	drawerWidth: number;
	collapsed: boolean;
}

const AppSidebar: React.FC<AppSidebarProps> = ({
	mobileOpen,
	onToggle,
	drawerWidth,
	collapsed,
}) => {
	const appName = import.meta.env.VITE_APP_NAME || "App";
	const abbreviation = appName
		.split(/[\s-]+/)
		.map((w: string) => w[0]?.toUpperCase() ?? "")
		.join("")
		.slice(0, 2);
	const navigate = useNavigate();
	const location = useLocation();
	const ability = useAbility();
	const user = useAuthStore((state) => state.user);
	const logout = useAuthStore((state) => state.logout);
	const collapsedWidth = 56;
	const effectiveWidth = collapsed ? collapsedWidth : drawerWidth;

	const isActive = (path: string) => location.pathname === path;

	const getSidebarItemSx = (collapsed: boolean) => ({
		py: 0.75,
		my: collapsed ? 1 : 0,
		borderRadius: 1,
		mx: collapsed ? 0 : 1,
		color: "var(--sidebar-text)",
		"&.Mui-selected": {
			bgcolor: "var(--sidebar-selected-bg)",
			color: "var(--sidebar-selected-text)",
			"&:hover": {
				bgcolor: "var(--sidebar-selected-bg)",
			},
		},
	});

	// Swipe handling state
	const touchStartX = useRef(0);
	const touchEndX = useRef(0);
	const MIN_SWIPE_THRESHOLD = 50;

	const handleTouchStart = (e: React.TouchEvent) => {
		touchStartX.current = e.changedTouches[0].screenX;
	};

	const handleTouchEnd = (e: React.TouchEvent) => {
		touchEndX.current = e.changedTouches[0].screenX;
		handleSwipe();
	};

	const handleSwipe = () => {
		const swipeDistance = touchEndX.current - touchStartX.current;

		// Swipe right to open
		if (swipeDistance > MIN_SWIPE_THRESHOLD && !mobileOpen) {
			onToggle();
		}
		// Swipe left to close
		if (swipeDistance < -MIN_SWIPE_THRESHOLD && mobileOpen) {
			onToggle();
		}
	};

	const handleNav = (path: string) => {
		navigate(path);
		if (mobileOpen) {
			onToggle();
		}
	};

	const [logoutDialogOpen, setLogoutDialogOpen] = React.useState(false);

	const handleLogoutClick = () => {
		setLogoutDialogOpen(true);
	};

	const handleLogoutConfirm = () => {
		setLogoutDialogOpen(false);
		logout();
		navigate("/login");
		if (mobileOpen) {
			onToggle();
		}
	};

	const handleLogoutCancel = () => {
		setLogoutDialogOpen(false);
	};

	const drawer = (
		<Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
			<Box
				sx={{
					p: 2,
					display: "flex",
					alignItems: "center",
					gap: 1,
				}}
			>
				<Typography
					variant="h6"
					component="div"
					sx={{ color: "var(--sidebar-text)" }}
				>
					{collapsed ? abbreviation : appName}
				</Typography>
			</Box>
			<Divider sx={{ borderColor: "var(--sidebar-text)", opacity: 0.2 }} />
			<List sx={{ flexGrow: 1 }}>
				<ListItemButton
					selected={isActive("/")}
					onClick={() => handleNav("/")}
					sx={getSidebarItemSx(collapsed)}
				>
					<ListItemIcon sx={{ minWidth: 36, color: "var(--sidebar-icon)" }}>
						<DashboardIcon sx={{ fontSize: 18 }} />
					</ListItemIcon>
					{!collapsed && (
						<ListItemText primary="Dashboard" sx={{ fontSize: 13 }} />
					)}
				</ListItemButton>
				<Can I="read" a="purchasing-requirements" ability={ability}>
					<ListItemButton
						selected={isActive("/purchasing-requirements")}
						onClick={() => handleNav("/purchasing-requirements")}
						sx={getSidebarItemSx(collapsed)}
					>
						<ListItemIcon sx={{ minWidth: 36, color: "var(--sidebar-icon)" }}>
							<AssignmentIcon sx={{ fontSize: 18 }} />
						</ListItemIcon>
						{!collapsed && (
							<ListItemText
								primary="Purchasing Requirements"
								sx={{ fontSize: 13 }}
							/>
						)}
					</ListItemButton>
				</Can>
				<Can I="read" a="inventory-items" ability={ability}>
					<ListItemButton
						selected={isActive("/inventory-items")}
						onClick={() => handleNav("/inventory-items")}
						sx={getSidebarItemSx(collapsed)}
					>
						<ListItemIcon sx={{ minWidth: 36, color: "var(--sidebar-icon)" }}>
							<InventoryIcon sx={{ fontSize: 18 }} />
						</ListItemIcon>
						{!collapsed && (
							<ListItemText primary="Inventory Items" sx={{ fontSize: 13 }} />
						)}
					</ListItemButton>
				</Can>
				<Can I="read" a="suppliers" ability={ability}>
					<ListItemButton
						selected={isActive("/suppliers")}
						onClick={() => handleNav("/suppliers")}
						sx={getSidebarItemSx(collapsed)}
					>
						<ListItemIcon sx={{ minWidth: 36, color: "var(--sidebar-icon)" }}>
							<LocalShippingIcon sx={{ fontSize: 18 }} />
						</ListItemIcon>
						{!collapsed && (
							<ListItemText primary="Suppliers" sx={{ fontSize: 13 }} />
						)}
					</ListItemButton>
				</Can>
				<Can I="read" a="purchase-orders" ability={ability}>
					<ListItemButton
						selected={isActive("/purchase-orders")}
						onClick={() => handleNav("/purchase-orders")}
						sx={getSidebarItemSx(collapsed)}
					>
						<ListItemIcon sx={{ minWidth: 36, color: "var(--sidebar-icon)" }}>
							<ShoppingBasketIcon sx={{ fontSize: 18 }} />
						</ListItemIcon>
						{!collapsed && (
							<ListItemText primary="Purchase Orders" sx={{ fontSize: 13 }} />
						)}
					</ListItemButton>
				</Can>
				<Can I="read" a="prices" ability={ability}>
					<ListItemButton
						selected={isActive("/prices")}
						onClick={() => handleNav("/prices")}
						sx={getSidebarItemSx(collapsed)}
					>
						<ListItemIcon sx={{ minWidth: 36, color: "var(--sidebar-icon)" }}>
							<MoneyIcon sx={{ fontSize: 18 }} />
						</ListItemIcon>
						{!collapsed && (
							<ListItemText primary="Prices" sx={{ fontSize: 13 }} />
						)}
					</ListItemButton>
				</Can>
				<Can I="read" a="users" ability={ability}>
					<ListItemButton
						selected={isActive("/users")}
						onClick={() => handleNav("/users")}
						sx={getSidebarItemSx(collapsed)}
					>
						<ListItemIcon sx={{ minWidth: 36, color: "var(--sidebar-icon)" }}>
							<PeopleIcon sx={{ fontSize: 18 }} />
						</ListItemIcon>
						{!collapsed && (
							<ListItemText primary="Users" sx={{ fontSize: 13 }} />
						)}
					</ListItemButton>
				</Can>
				<Can I="read" a="settings" ability={ability}>
					<ListItemButton
						selected={isActive("/settings")}
						onClick={() => handleNav("/settings")}
						sx={getSidebarItemSx(collapsed)}
					>
						<ListItemIcon sx={{ minWidth: 36, color: "var(--sidebar-icon)" }}>
							<SettingsIcon sx={{ fontSize: 18 }} />
						</ListItemIcon>
						{!collapsed && (
							<ListItemText primary="Settings" sx={{ fontSize: 13 }} />
						)}
					</ListItemButton>
				</Can>
			</List>
			<Divider sx={{ borderColor: "var(--sidebar-text)", opacity: 0.2 }} />
			<Accordion
				sx={{
					boxShadow: "none",
					"&:before": { display: "none" },
					"&.Mui-expanded": { margin: 0 },
					bgcolor: "var(--sidebar-bg)",
				}}
			>
				<AccordionSummary
					expandIcon={<ExpandMoreIcon sx={{ color: "var(--sidebar-icon)" }} />}
					sx={{
						minHeight: 40,
						"&.Mui-expanded": { minHeight: 50 },
						display: "flex",
						alignItems: "center",
						color: "var(--sidebar-text)",
						bgcolor: "var(--sidebar-bg)",
					}}
				>
					{!collapsed && (
						<ListItemIcon sx={{ minWidth: 36, color: "var(--sidebar-icon)" }}>
							<AccountCircleIcon sx={{ fontSize: 18 }} />
						</ListItemIcon>
					)}
					{!collapsed && (
						<Box sx={{ overflow: "hidden" }}>
							<Typography
								variant="body2"
								sx={{
									fontWeight: "bold",
									fontSize: 12,
									color: "var(--sidebar-text)",
								}}
							>
								{user?.name || user?.username || "User"}
							</Typography>
							{user?.username && (
								<Typography
									variant="caption"
									sx={{
										fontSize: 10,
										color: "var(--sidebar-text)",
										opacity: 0.7,
									}}
								>
									@{user.username}
								</Typography>
							)}
						</Box>
					)}
				</AccordionSummary>
				<AccordionDetails sx={{ p: 0, bgcolor: "var(--sidebar-bg)" }}>
					<ListItemButton
						onClick={() => handleNav("/profile")}
						sx={{
							py: 0.75,
							minHeight: "40px",
							color: "var(--sidebar-text)",
						}}
					>
						<ListItemIcon sx={{ minWidth: 36, color: "var(--sidebar-icon)" }}>
							<AccountCircleIcon sx={{ fontSize: 16 }} />
						</ListItemIcon>
						{!collapsed && (
							<ListItemText primary="Profile" sx={{ fontSize: 12 }} />
						)}
					</ListItemButton>
					<ListItemButton
						onClick={handleLogoutClick}
						sx={{
							py: 0.75,
							minHeight: "40px",
							color: "var(--sidebar-text)",
							alignItems: "center",
						}}
					>
						<ListItemIcon sx={{ minWidth: 36, color: "var(--sidebar-icon)" }}>
							<LogoutIcon sx={{ fontSize: 16 }} />
						</ListItemIcon>
						{!collapsed && (
							<ListItemText primary="Logout" sx={{ fontSize: 12 }} />
						)}
					</ListItemButton>
				</AccordionDetails>
			</Accordion>
		</Box>
	);

	return (
		<Box
			component="nav"
			sx={{
				width: { md: effectiveWidth },
				flexShrink: { md: 0 },
				position: "relative",
			}}
		>
			{/* Touch edge for opening sidebar on mobile */}
			<Box
				sx={{
					display: { xs: "block", md: "none" },
					position: "fixed",
					left: 0,
					top: 0,
					width: 20,
					height: "100vh",
					zIndex: 1300, // Above drawer
					cursor: "pointer",
				}}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}
			/>
			<Drawer
				variant="temporary"
				open={mobileOpen}
				onClose={onToggle}
				ModalProps={{
					keepMounted: true,
				}}
				sx={{
					display: { xs: "block", md: "none" },
					"& .MuiDrawer-paper": {
						boxSizing: "border-box",
						width: drawerWidth,
						bgcolor: "var(--sidebar-bg)",
						color: "var(--sidebar-text)",
					},
				}}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}
			>
				{drawer}
			</Drawer>
			<Drawer
				variant="permanent"
				sx={{
					display: { xs: "none", md: "block" },
					"& .MuiDrawer-paper": {
						boxSizing: "border-box",
						width: effectiveWidth,
						bgcolor: "var(--sidebar-bg)",
						color: "var(--sidebar-text)",
					},
				}}
				open
			>
				{drawer}
			</Drawer>
			<Dialog
				open={logoutDialogOpen}
				onClose={handleLogoutCancel}
				aria-labelledby="logout-dialog-title"
				aria-describedby="logout-dialog-description"
			>
				<DialogTitle id="logout-dialog-title">Confirm Logout</DialogTitle>
				<DialogContent>
					<DialogContentText id="logout-dialog-description">
						Are you sure you want to logout?
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleLogoutCancel}>Cancel</Button>
					<Button onClick={handleLogoutConfirm} color="error" autoFocus>
						Logout
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};

export default AppSidebar;
