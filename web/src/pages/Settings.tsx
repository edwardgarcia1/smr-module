import React, { useEffect } from "react";
import {
	Box,
	Paper,
	List,
	ListItem,
	ListItemText,
	ListItemSecondaryAction,
	Switch,
} from "@mui/material";
import { useThemeMode } from "../providers/AppProvider";

const Settings: React.FC = () => {
	const { darkMode, setDarkMode } = useThemeMode();

	// Load settings from localStorage on mount
	useEffect(() => {
		const savedSettings = localStorage.getItem("userSettings");
		if (savedSettings) {
			try {
				JSON.parse(savedSettings);
				// darkMode is handled by AppProvider
			} catch (error) {
				console.error("Failed to parse user settings:", error);
			}
		}
	}, []);

	// Save settings to localStorage whenever they change
	const updateSetting = (key: string, value: boolean | number) => {
		const currentSettings = {
			darkMode,
			[key]: value,
		};
		localStorage.setItem("userSettings", JSON.stringify(currentSettings));

		if (key === "darkMode") {
			setDarkMode(value as boolean);
		}
	};

	return (
		<Box sx={{}}>
			<Paper elevation={2} sx={{ mb: 2 }}>
				<List>
					<ListItem sx={{ pr: 8 }}>
						<ListItemText
							primary="Dark Mode"
							secondary="Use dark theme across the application"
							sx={{
								"& .MuiListItemText-primary": {
									whiteSpace: "normal",
									wordBreak: "break-word",
								},
								"& .MuiListItemText-secondary": {
									whiteSpace: "normal",
									wordBreak: "break-word",
								},
							}}
						/>
						<ListItemSecondaryAction>
							<Switch
								edge="end"
								checked={darkMode}
								onChange={(e) => updateSetting("darkMode", e.target.checked)}
							/>
						</ListItemSecondaryAction>
					</ListItem>

				</List>
			</Paper>
		</Box>
	);
};

export default Settings;
