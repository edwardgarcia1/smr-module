import React, { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
	ThemeProvider as MuiThemeProvider,
	createTheme,
} from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

interface ThemeContextType {
	darkMode: boolean;
	setDarkMode: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeMode = () => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useThemeMode must be used within AppProvider");
	}
	return context;
};

interface AppProviderProps {
	children: ReactNode;
}

const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
	const [darkMode, setDarkMode] = useState(() => {
		const savedSettings = localStorage.getItem("userSettings");
		if (savedSettings) {
			try {
				const settings = JSON.parse(savedSettings);
				if (typeof settings.darkMode === "boolean") {
					return settings.darkMode;
				}
			} catch (error) {
				console.error("Failed to parse user settings:", error);
			}
		}
		// Fallback to system preference
		return window.matchMedia("(prefers-color-scheme: dark)").matches;
	});

	const theme = createTheme({
		palette: {
			mode: darkMode ? "dark" : "light",
			primary: {
				main: "#1976d2",
			},
			secondary: {
				main: "#dc004e",
			},
		},
	});

	useEffect(() => {
		if (!darkMode) {
			document.documentElement.classList.remove("dark-mode");
		}
	}, [darkMode]);

	return (
		<ThemeContext.Provider value={{ darkMode, setDarkMode }}>
			<MuiThemeProvider theme={theme}>
				<CssBaseline />
				{children}
			</MuiThemeProvider>
		</ThemeContext.Provider>
	);
};

export default AppProvider;
