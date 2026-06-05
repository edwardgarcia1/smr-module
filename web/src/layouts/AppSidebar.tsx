/**
 * AppSidebar — Navigation drawer with collapsed mode, mobile swipe, and
 * CASL-guarded nav items.
 *
 * Drawer structure is handled here; nav items and user menu are delegated
 * to sub-components.
 */
import React, { useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
	Drawer,
	Box,
	Typography,
	Divider,
} from "@mui/material";
import { useAbility } from "../config/AbilityProvider";
import { useAuthStore } from "../store/useAuthStore";
import SidebarNavList from "../components/sidebar/SidebarNavList";
import SidebarUserMenu from "../components/sidebar/SidebarUserMenu";

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
	const { ability } = useAbility();
	const user = useAuthStore((state) => state.user);
	const logout = useAuthStore((state) => state.logout);
	const collapsedWidth = 56;
	const effectiveWidth = collapsed ? collapsedWidth : drawerWidth;

	const isActive = (path: string) => location.pathname === path;

	const getSidebarItemSx = (collapsed: boolean) => ({
		py: collapsed ? 1.5 : 0.75,
		borderRadius: 1,
		mx: collapsed ? 0 : 1,
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
		color: "var(--sidebar-text)",
		"&.Mui-selected": {
			bgcolor: "var(--sidebar-selected-bg)",
			color: "var(--sidebar-selected-text)",
			"&:hover": {
				bgcolor: "var(--sidebar-selected-bg)",
			},
		},
	});

	// Swipe handling
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
		if (swipeDistance > MIN_SWIPE_THRESHOLD && !mobileOpen) onToggle();
		if (swipeDistance < -MIN_SWIPE_THRESHOLD && mobileOpen) onToggle();
	};

	const handleNav = (path: string) => {
		navigate(path);
		if (mobileOpen) onToggle();
	};

	const handleLogout = () => {
		logout();
		navigate("/login");
		if (mobileOpen) onToggle();
	};

	const drawer = (
		<Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
			{/* Sticky header */}
			<Box sx={{ flexShrink: 0, bgcolor: "var(--sidebar-bg)" }}>
				<Box sx={{ p: 2, gap: 1 }}>
					<Typography
						variant="h6"
						component="div"
						sx={{ color: "var(--sidebar-text)" }}
					>
						{collapsed ? abbreviation : appName}
					</Typography>
				</Box>
				<Divider
					sx={{ borderColor: "var(--sidebar-text)", opacity: 0.2 }}
				/>
			</Box>

			{/* Navigation items */}
			<SidebarNavList
				collapsed={collapsed}
				isActive={isActive}
				onNav={handleNav}
				getSx={getSidebarItemSx}
				ability={ability}
			/>

			{/* User menu footer */}
			<SidebarUserMenu
				collapsed={collapsed}
				user={user}
				getSx={getSidebarItemSx}
				onNav={handleNav}
				onLogout={handleLogout}
			/>
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
					zIndex: 1300,
					cursor: "pointer",
				}}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}
			/>
			<Drawer
				variant="temporary"
				open={mobileOpen}
				onClose={onToggle}
				ModalProps={{ keepMounted: true }}
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
		</Box>
	);
};

export default AppSidebar;
