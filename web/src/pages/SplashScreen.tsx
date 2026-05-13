import React from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import InventoryIcon from "@mui/icons-material/Inventory";

const appName = import.meta.env.VITE_APP_NAME || "Stock Management";

const SplashScreen: React.FC = () => {
	return (
		<Box
			sx={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				minHeight: "100vh",
				bgcolor: "background.default",
				gap: 3,
			}}
		>
			<InventoryIcon
				sx={{
					fontSize: 64,
					color: "primary.main",
				}}
			/>
			<Typography variant="h5" fontWeight={600} color="text.primary">
				{appName}
			</Typography>
			<Typography variant="body2" color="text.secondary">
				Loading your workspace…
			</Typography>
			<CircularProgress size={28} sx={{ mt: 1 }} />
		</Box>
	);
};

export default SplashScreen;
