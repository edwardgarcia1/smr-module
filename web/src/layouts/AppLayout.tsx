import React, { useState, useEffect } from "react";
import { Box } from "@mui/material";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";

interface AppLayoutProps {
	children: React.ReactNode;
	currentTab?: string;
	isLoading?: boolean;
}

const drawerWidth = 240;
const collapsedWidth = 56;

const AppLayout: React.FC<AppLayoutProps> = ({
	children,
	currentTab = "",
	isLoading = false,
}) => {
	const [mobileOpen, setMobileOpen] = useState(false);
	const [collapsed, setCollapsed] = useState(() => {
		const saved = localStorage.getItem("sidebarCollapsed");
		return saved ? JSON.parse(saved) : false;
	});

	useEffect(() => {
		localStorage.setItem("sidebarCollapsed", JSON.stringify(collapsed));
	}, [collapsed]);

	const handleDrawerToggle = () => {
		setMobileOpen(!mobileOpen);
	};

	const handleCollapseToggle = () => {
		setCollapsed(!collapsed);
	};

	const effectiveWidth = collapsed ? collapsedWidth : drawerWidth;

	return (
		<Box
			sx={{
				display: "flex",
				height: "100vh",
				padding:
					"env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
				bgcolor: "var(--bg)",
			}}
		>
			<AppHeader
				onMenuClick={handleDrawerToggle}
				drawerWidth={effectiveWidth}
				currentTab={currentTab}
				onCollapseClick={handleCollapseToggle}
				isLoading={isLoading}
			/>
			<AppSidebar
				mobileOpen={mobileOpen}
				onToggle={handleDrawerToggle}
				drawerWidth={drawerWidth}
				collapsed={collapsed}
			/>
			<Box
				component="main"
				sx={{
					flexGrow: 1,
					width: { md: `calc(100% - ${effectiveWidth}px)` },
					overflow: "hidden",
					minWidth: 0,
					bgcolor: "var(--bg)",
				}}
			>
				<Box sx={{ height: 64 }} />
				<Box sx={{ height: "calc(100vh - 64px)", overflowY: "auto", p: 3 }}>
					{children}
				</Box>
			</Box>
		</Box>
	);
};

export default AppLayout;
