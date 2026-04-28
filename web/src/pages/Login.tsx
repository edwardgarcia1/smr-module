import React, { useState } from "react";
import {
	Box,
	Button,
	Container,
	CssBaseline,
	TextField,
	Typography,
	Paper,
	Alert,
	Link,
} from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
const appName = import.meta.env.VITE_APP_NAME;

const Login: React.FC = () => {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();
	const login = useAuthStore((state) => state.login);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/api/auth/login`,
				{
					method: "POST",
					credentials: "include",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ username, password }),
				},
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || errorData.message || "Login failed");
			}

			const data = await response.json();
			login(data.user);
			navigate("/");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Login failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Box
			sx={{
				display: "flex",
				minHeight: "100vh",
				background: "var(--bg)",
				padding:
					"env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
			}}
		>
			<Container
				component="main"
				maxWidth="xs"
				sx={{
					mt: 2,
					mb: 12,
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					flex: 1,
				}}
			>
				<CssBaseline />
				<Paper
					elevation={3}
					sx={{
						p: 4,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						borderRadius: 3,
					}}
				>
					<LoginIcon sx={{ fontSize: 48, color: "var(--accent)", mb: 2 }} />
					<Typography
						component="h1"
						variant="h5"
						sx={{ color: "var(--text-h)" }}
					>
						Sign in to {appName}
					</Typography>
					<Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
						{error && (
							<Alert severity="error" sx={{ width: "100%", mb: 2 }}>
								{error}
							</Alert>
						)}
						<TextField
							margin="normal"
							required
							fullWidth
							id="username"
							label="Username"
							name="username"
							autoComplete="username"
							autoFocus
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							sx={{
								"& .MuiOutlinedInput-root": {
									borderRadius: 2,
								},
								"& .Mui-focused .MuiOutlinedInput-notchedOutline": {
									borderColor: "var(--accent)",
								},
							}}
						/>
						<TextField
							margin="normal"
							required
							fullWidth
							name="password"
							label="Password"
							type="password"
							id="password"
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							sx={{
								"& .MuiOutlinedInput-root": {
									borderRadius: 2,
								},
								"& .Mui-focused .MuiOutlinedInput-notchedOutline": {
									borderColor: "var(--accent)",
								},
							}}
						/>
						<Button
							type="submit"
							fullWidth
							variant="contained"
							sx={{
								mt: 3,
								mb: 2,
								borderRadius: 2,
								backgroundColor: "var(--accent)",
								"&:hover": {
									backgroundColor: "var(--accent)",
									opacity: 0.9,
								},
							}}
							disabled={loading}
						>
							{loading ? "Signing In…" : "Sign In"}
						</Button>
						<Box sx={{ textAlign: "center", mt: 2 }}>
							<Link
								href="/register"
								variant="body2"
								sx={{ color: "var(--text)" }}
							>
								{"Don't have an account? Sign Up"}
							</Link>
						</Box>
					</Box>
				</Paper>
			</Container>
		</Box>
	);
};

export default Login;
