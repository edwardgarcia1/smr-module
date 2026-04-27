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

	// Define theme colors based on CSS variables
	// Light theme colors
	const lightPrimary = "#aa3bff"; // accent
	const lightBg = "#ffffff";
	const lightText = "#08060d";

	// Dark theme colors
	const darkPrimary = "#c084fc"; // accent
	const darkBg = "#16171d"; // dark background
	const darkText = "#f3f4f6"; // bright text

	const theme = createTheme({
		palette: {
			mode: darkMode ? "dark" : "light",
			primary: {
				main: darkMode ? darkPrimary : lightPrimary,
				contrastText: darkMode ? darkBg : lightBg,
			},
			secondary: {
				main: darkMode ? "#c084fc" : "#aa3bff", // accent variant
			},
			background: {
				default: darkMode ? darkBg : lightBg,
				paper: darkMode ? "#1f2028" : "#f4f3ec", // code-bg
			},
			text: {
				primary: darkMode ? darkText : lightText,
				secondary: darkMode ? "#9ca3af" : "#6b6375",
			},
		},
		typography: {
			fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
		},
		components: {
			MuiPaper: {
				styleOverrides: {
					root: {
						backgroundColor: darkMode ? "#1f2028" : "#f4f3ec",
					},
				},
			},
			MuiButton: {
				styleOverrides: {
					root: {
						borderRadius: "8px",
						textTransform: "none",
					},
				},
			},
			MuiCard: {
				styleOverrides: {
					root: {
						borderRadius: "12px",
					},
				},
			},
		},
	});

	useEffect(() => {
		if (darkMode) {
			document.documentElement.classList.add("dark-mode");
		} else {
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
