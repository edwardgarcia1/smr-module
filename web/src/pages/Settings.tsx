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
} from "@mui/material";
import { useThemeMode } from "../providers/AppProvider";

const Settings: React.FC = () => {
	const [notifications, setNotifications] = useState(true);
	const [autoSave, setAutoSave] = useState(true);
	const [compactMode, setCompactMode] = useState(false);
	const { darkMode, setDarkMode } = useThemeMode();

	// Load settings from localStorage on mount
	useEffect(() => {
		const savedSettings = localStorage.getItem("userSettings");
		if (savedSettings) {
			try {
				const settings = JSON.parse(savedSettings);
				setNotifications(settings.notifications ?? true);
				// darkMode is handled by AppProvider
				setAutoSave(settings.autoSave ?? true);
				setCompactMode(settings.compactMode ?? false);
			} catch (error) {
				console.error("Failed to parse user settings:", error);
			}
		}
	}, []);

	// Save settings to localStorage whenever they change
	const updateSetting = (key: string, value: boolean) => {
		const currentSettings = {
			notifications,
			darkMode,
			autoSave,
			compactMode,
			[key]: value,
		};
		localStorage.setItem("userSettings", JSON.stringify(currentSettings));

		switch (key) {
			case "notifications":
				setNotifications(value);
				break;
			case "darkMode":
				setDarkMode(value);
				break;
			case "autoSave":
				setAutoSave(value);
				break;
			case "compactMode":
				setCompactMode(value);
				break;
		}
	};

	return (
		<Box sx={{}}>
			<Paper elevation={2} sx={{ mb: 2 }}>
				<List>
					<ListItem>
						<ListItemText
							primary="Notifications"
							secondary="Receive email notifications for important updates"
						/>
						<ListItemSecondaryAction>
							<Switch
								edge="end"
								checked={notifications}
								onChange={(e) =>
									updateSetting("notifications", e.target.checked)
								}
							/>
						</ListItemSecondaryAction>
					</ListItem>

					<Divider />

					<ListItem>
						<ListItemText
							primary="Dark Mode"
							secondary="Use dark theme across the application"
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

					<ListItem>
						<ListItemText
							primary="Auto Save"
							secondary="Automatically save changes as you type"
						/>
						<ListItemSecondaryAction>
							<Switch
								edge="end"
								checked={autoSave}
								onChange={(e) => updateSetting("autoSave", e.target.checked)}
							/>
						</ListItemSecondaryAction>
					</ListItem>

					<Divider />

					<ListItem>
						<ListItemText
							primary="Compact Mode"
							secondary="Use compact layout with reduced spacing"
						/>
						<ListItemSecondaryAction>
							<Switch
								edge="end"
								checked={compactMode}
								onChange={(e) => updateSetting("compactMode", e.target.checked)}
							/>
						</ListItemSecondaryAction>
					</ListItem>
				</List>
			</Paper>
		</Box>
	);
};

export default Settings;
