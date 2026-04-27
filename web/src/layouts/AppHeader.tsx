import React from "react";
import {
	AppBar,
	Toolbar,
	Typography,
	IconButton,
	Skeleton,
	Box,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

interface AppHeaderProps {
	onMenuClick: () => void;
	drawerWidth: number;
	currentTab: string;
	onCollapseClick: () => void;
	isLoading?: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({
	onMenuClick,
	drawerWidth,
	currentTab,
	onCollapseClick,
	isLoading = false,
}) => {
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
						width={150}
						height={32}
						sx={{ bgcolor: "grey.300", opacity: 0.5 }}
					/>
				) : (
					<Typography
						noWrap
						component="div"
						sx={{ flexGrow: 1, color: "var(--text)", fontWeight: 400 }}
					>
						{currentTab || "Fullstack Starter"}
					</Typography>
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
