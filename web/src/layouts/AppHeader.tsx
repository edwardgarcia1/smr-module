import React from "react";
import { useNavigate } from "react-router-dom";
import {
	AppBar,
	Toolbar,
	Typography,
	IconButton,
	Skeleton,
	Box,
	Breadcrumbs,
	Link,
	Chip,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useAuthStore } from "../store/useAuthStore";

export interface BreadcrumbItem {
	label: string;
	href?: string;
}

interface AppHeaderProps {
	onMenuClick: () => void;
	drawerWidth: number;
	breadcrumbs: BreadcrumbItem[];
	onCollapseClick: () => void;
	isLoading?: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({
	onMenuClick,
	drawerWidth,
	breadcrumbs,
	onCollapseClick,
	isLoading = false,
}) => {
	const navigate = useNavigate();
	const user = useAuthStore((s) => s.user);
	const availableTenants = useAuthStore((s) => s.availableTenants);
	const currentDate = new Date().toLocaleDateString("en-PH", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	return (
		<AppBar
			position="fixed"
			sx={{
				width: { md: `calc(100% - ${drawerWidth}px)` },
				ml: { md: `${drawerWidth}px` },
				backgroundColor: "var(--bg)",
				color: "var(--text)",
				boxShadow: "0",
			}}
		>
			<Toolbar>
				{/* Mobile menu button (hidden on md+) */}
				<IconButton
					color="inherit"
					aria-label="open drawer"
					edge="start"
					onClick={onMenuClick}
					sx={{ mr: 2, display: { md: "none" } }}
				>
					<MenuIcon />
				</IconButton>
				{/* Desktop collapse button (visible on md+) */}
				<IconButton
					color="inherit"
					aria-label="toggle sidebar"
					onClick={onCollapseClick}
					sx={{ mr: 2, display: { xs: "none", md: "inline-flex" } }}
				>
					<MenuIcon />
				</IconButton>
				{isLoading ? (
					<Skeleton
						variant="text"
						width={200}
						height={32}
						sx={{ bgcolor: "grey.300", opacity: 0.5 }}
					/>
				) : breadcrumbs.length > 0 ? (
					<Breadcrumbs
						aria-label="page breadcrumb"
						sx={{
							flexGrow: 1,
							"& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" },
							"& .MuiBreadcrumbs-li": { whiteSpace: "nowrap" },
						}}
					>
						{breadcrumbs.map((crumb, index) => {
							const isLast = index === breadcrumbs.length - 1;
							return isLast || !crumb.href ? (
								<Typography
									key={index}
									sx={{
										color: "var(--text)",
										fontWeight: isLast ? 500 : 400,
										fontSize: isLast ? 15 : 13,
										opacity: isLast ? 1 : 0.6,
									}}
								>
									{crumb.label}
								</Typography>
							) : (
								<Link
									key={index}
									underline="hover"
									sx={{
										color: "var(--text)",
										fontSize: 13,
										opacity: 0.6,
										cursor: "pointer",
										"&:hover": { opacity: 1 },
									}}
									onClick={(e) => {
										e.preventDefault();
										navigate(crumb.href!);
									}}
								>
									{crumb.label}
								</Link>
							);
						})}
					</Breadcrumbs>
				) : null}
				{user?.tenant && (
					<Chip
						label={
							availableTenants.find((t) => t.key === user.tenant)?.displayName ??
							user.tenant
						}
						size="small"
						variant="outlined"
						sx={{ mr: 2, color: "var(--text)", borderColor: "var(--text)" }}
					/>
				)}
				<Box sx={{ display: "flex", alignItems: "center", ml: "auto" }}>
					<Typography
						variant="body1"
						sx={{
							fontSize: 13,
							color: "var(--text)",
							opacity: 0.5,
							fontWeight: 400,
						}}
					>
						{currentDate}
					</Typography>
				</Box>
			</Toolbar>
		</AppBar>
	);
};

export default AppHeader;
