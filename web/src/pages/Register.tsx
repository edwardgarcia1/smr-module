import React, { useState, useRef, useEffect } from "react";
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
import AppRegistrationIcon from "@mui/icons-material/AppRegistration";
import { useNavigate } from "react-router-dom";
const appName = import.meta.env.VITE_APP_NAME;

const Register: React.FC = () => {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();
	const isMounted = useRef(true);

	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccess(null);
		setLoading(true);

		try {
			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/api/auth/register`,
				{
					method: "POST",
					credentials: "include",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ username, password, name }),
				},
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				setError(errorData.error || errorData.message || "Registration failed");
				setLoading(false);
				throw new Error(
					errorData.error || errorData.message || "Registration failed",
				);
			}

			setSuccess("Registration successful! Redirecting to login…");
			setTimeout(() => {
				if (isMounted.current) {
					navigate("/login");
				}
			}, 2000);
			console.log("SUCCESS");
		} catch (err) {
			if (isMounted.current) {
				setError(err instanceof Error ? err.message : "Registration failed");
			}
		} finally {
			if (isMounted.current) {
				setLoading(false);
			}
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
					<AppRegistrationIcon
						sx={{ fontSize: 48, color: "var(--accent)", mb: 2 }}
					/>
					<Typography
						component="h1"
						variant="h5"
						sx={{ color: "var(--text-h)" }}
					>
						Sign up to {appName}
					</Typography>
					<Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
						{error && (
							<Alert severity="error" sx={{ width: "100%", mb: 2 }}>
								{error}
							</Alert>
						)}
						{success && (
							<Alert severity="success" sx={{ width: "100%", mb: 2 }}>
								{success}
							</Alert>
						)}
						<TextField
							margin="normal"
							required
							fullWidth
							id="name"
							label="Full Name"
							name="name"
							autoComplete="name"
							autoFocus
							value={name}
							onChange={(e) => setName(e.target.value)}
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
							id="username"
							label="Username"
							name="username"
							autoComplete="username"
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
							autoComplete="new-password"
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
							{loading ? "Creating Account…" : "Sign Up"}
						</Button>
						<Box sx={{ textAlign: "center", mt: 2 }}>
							<Link href="/login" variant="body2" sx={{ color: "var(--text)" }}>
								{"Already have an account? Sign In"}
							</Link>
						</Box>
					</Box>
				</Paper>
			</Container>
		</Box>
	);
};

export default Register;
