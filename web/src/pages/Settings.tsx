import React, { useState, useEffect } from "react";
import {
	Box,
	Divider,
	Paper,
	List,
	ListItem,
	ListItemText,
	ListItemSecondaryAction,
	Switch,
	TextField,
} from "@mui/material";
import { useThemeMode } from "../providers/AppProvider";

const Settings: React.FC = () => {
	const [monthlyFactor, setMonthlyFactor] = useState(1.5);
	const { darkMode, setDarkMode } = useThemeMode();

	// Load settings from localStorage on mount
	useEffect(() => {
		const savedSettings = localStorage.getItem("userSettings");
		if (savedSettings) {
			try {
				const settings = JSON.parse(savedSettings);
				// darkMode is handled by AppProvider
				setMonthlyFactor(settings.monthlyFactor ?? 1.5);
			} catch (error) {
				console.error("Failed to parse user settings:", error);
			}
		}
	}, []);

	// Save settings to localStorage whenever they change
	const updateSetting = (key: string, value: boolean | number) => {
		const currentSettings = {
			darkMode,
			monthlyFactor,
			[key]: value,
		};
		localStorage.setItem("userSettings", JSON.stringify(currentSettings));

		switch (key) {
			case "darkMode":
				setDarkMode(value as boolean);
				break;
			case "monthlyFactor":
				setMonthlyFactor(value as number);
				break;
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

					<Divider />

					<ListItem sx={{ pr: 16 }}>
						<ListItemText
							primary="Monthly Factor"
							secondary="Multiplier applied to highest monthly demand to calculate suggested order quantity. Default: 1.5"
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
					<TextField
							type="number"
							size="small"
							sx={{ width: 100 }}
							slotProps={{
								htmlInput: {
									step: 0.1,
									min: 0,
								},
							}}
							value={monthlyFactor}
							onChange={(e) =>
								updateSetting(
									"monthlyFactor",
									parseFloat(e.target.value) || 0,
								)
							}
						/>
						</ListItemSecondaryAction>
					</ListItem>
				</List>
			</Paper>
		</Box>
	);
};

export default Settings;
