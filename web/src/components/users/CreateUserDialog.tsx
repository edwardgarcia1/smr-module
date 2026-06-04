import React, { useState } from "react";
import {
	Box,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	TextField,
	Alert,
	CircularProgress,
	Typography,
	IconButton,
	InputAdornment,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { authService } from "../../services/auth";

interface CreateUserDialogProps {
	open: boolean;
	onClose: () => void;
	onCreated: () => void;
}

const CreateUserDialog: React.FC<CreateUserDialogProps> = ({
	open,
	onClose,
	onCreated,
}) => {
	const [name, setName] = useState("");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [confirmPasswordError, setConfirmPasswordError] = useState<
		string | null
	>(null);

	const handleClose = () => {
		if (loading) return;
		onClose();
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setConfirmPasswordError(null);

		if (password !== confirmPassword) {
			setConfirmPasswordError("Passwords do not match");
			return;
		}

		if (!name.trim() || !username.trim() || !password.trim()) {
			setError("All fields are required");
			return;
		}

		setLoading(true);
		try {
			await authService.register(username.trim(), password, name.trim());
			setName("");
			setUsername("");
			setPassword("");
			setConfirmPassword("");
			onCreated();
			onClose();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to create user",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog
			open={open}
			onClose={handleClose}
			maxWidth="xs"
			fullWidth
			slotProps={{ paper: { sx: { borderRadius: 2 } } }}
		>
			<Box
				component="form"
				onSubmit={handleSubmit}
				sx={{ display: "flex", flexDirection: "column" }}
			>
				<DialogTitle sx={{ pb: 0 }}>
					<Typography variant="h6" sx={{ fontWeight: 600 }}>
						Create User
					</Typography>
				</DialogTitle>

				<DialogContent sx={{ pt: 2 }}>
					{error && (
						<Alert severity="error" sx={{ mb: 2 }}>
							{error}
						</Alert>
					)}

					<TextField
						autoFocus
						margin="dense"
						required
						fullWidth
						id="name"
						label="Full Name"
						name="name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						disabled={loading}
						sx={{
							"& .MuiOutlinedInput-root": { borderRadius: 2 },
						}}
					/>
					<TextField
						margin="dense"
						required
						fullWidth
						id="username"
						label="Username"
						name="username"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						disabled={loading}
						sx={{
							"& .MuiOutlinedInput-root": { borderRadius: 2 },
						}}
					/>
					<TextField
						margin="dense"
						required
						fullWidth
						name="password"
						label="Password"
						type={showPassword ? "text" : "password"}
						id="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						disabled={loading}
						sx={{
							"& .MuiOutlinedInput-root": { borderRadius: 2 },
						}}
						slotProps={{
							input: {
								endAdornment: (
									<InputAdornment position="end">
										<IconButton
											aria-label={
												showPassword ? "hide password" : "show password"
											}
											onClick={() => setShowPassword((s) => !s)}
											onMouseDown={(e) => e.preventDefault()}
											edge="end"
											size="small"
										>
											{showPassword ? <VisibilityOff /> : <Visibility />}
										</IconButton>
									</InputAdornment>
								),
							},
						}}
					/>
					<TextField
						margin="dense"
						required
						fullWidth
						name="confirmPassword"
						label="Confirm Password"
						type={showConfirmPassword ? "text" : "password"}
						id="confirmPassword"
						value={confirmPassword}
						onChange={(e) => {
							setConfirmPassword(e.target.value);
							if (confirmPasswordError) setConfirmPasswordError(null);
						}}
						disabled={loading}
						error={!!confirmPasswordError}
						helperText={confirmPasswordError}
						sx={{
							"& .MuiOutlinedInput-root": { borderRadius: 2 },
						}}
						slotProps={{
							input: {
								endAdornment: (
									<InputAdornment position="end">
										<IconButton
											aria-label={
												showConfirmPassword
													? "hide confirm password"
													: "show confirm password"
											}
											onClick={() => setShowConfirmPassword((s) => !s)}
											onMouseDown={(e) => e.preventDefault()}
											edge="end"
											size="small"
										>
											{showConfirmPassword ? (
												<VisibilityOff />
											) : (
												<Visibility />
											)}
										</IconButton>
									</InputAdornment>
								),
							},
						}}
					/>
				</DialogContent>

				<DialogActions sx={{ px: 3, pb: 2 }}>
					<Button onClick={handleClose} disabled={loading} color="inherit">
						Cancel
					</Button>
					<Button
						type="submit"
						variant="contained"
						disabled={loading}
						startIcon={loading ? <CircularProgress size={16} /> : undefined}
					>
						{loading ? "Creating..." : "Create"}
					</Button>
				</DialogActions>
			</Box>
		</Dialog>
	);
};

export default CreateUserDialog;
