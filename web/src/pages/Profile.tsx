import React, { useEffect, useState, useMemo } from "react";
import {
	Box,
	Typography,
	Paper,
	Avatar,
	Divider,
	List,
	ListItem,
	ListItemText,
	ListItemIcon,
	Skeleton,
	Alert,
	Chip,
	Stack,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import BadgeIcon from "@mui/icons-material/Badge";
import SecurityIcon from "@mui/icons-material/Security";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import { useAuthStore } from "../store/useAuthStore";
import { api } from "../services/api";
import { ALL_MODULES, type PermissionRow } from "../config/ability";

interface UserProfile {
	id: string;
	username: string;
	name: string;
}

/** Human-readable label for each permission action. */
const ACTION_LABELS: Record<string, string> = {
	manage: "Full Access",
	create: "Create",
	read: "Read",
	update: "Update",
	delete: "Delete",
};

/** Chip color for each action. */
const ACTION_COLORS: Record<string, "success" | "info" | "warning" | "error" | "primary"> = {
	manage: "success",
	create: "info",
	read: "primary",
	update: "warning",
	delete: "error",
};

const Profile: React.FC = () => {
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [permissions, setPermissions] = useState<PermissionRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const authUser = useAuthStore((state) => state.user);

	useEffect(() => {
		const controller = new AbortController();

		const fetchProfile = async () => {
			try {
				const data = await api.apiRequest<UserProfile>("/users/profile", {
					method: "GET",
					signal: controller.signal,
				});
				setProfile(data);

				// Fetch permissions for this user (self-service allowed by backend)
				const perms = await api.apiRequest<PermissionRow[]>(
					`/users/${data.id}/permissions`,
					{ method: "GET", signal: controller.signal },
				);
				setPermissions(perms);
			} catch (err) {
				if (err instanceof DOMException && err.name === "AbortError") return;
				setError(
					err instanceof Error ? err.message : "Failed to fetch profile",
				);
			} finally {
				setLoading(false);
			}
		};

		fetchProfile();

		return () => controller.abort();
	}, []);

	/** Map of subject -> allowed actions. Includes ALL_MODULES so every known module appears. */
	const permissionMap = useMemo(() => {
		const map = new Map<string, Set<string>>();
		for (const module of ALL_MODULES) {
			map.set(module, new Set());
		}
		for (const perm of permissions) {
			const actions = map.get(perm.subject) ?? new Set();
			actions.add(perm.action);
			map.set(perm.subject, actions);
		}
		return map;
	}, [permissions]);

	const profileData = profile || authUser;

	/** Render action chips for a given module. */
	const renderActions = (module: string, actions: Set<string>) => {
		// Dashboard is always accessible — no permission check needed
		if (module === "Dashboard") {
			return (
				<Chip
					icon={<CheckCircleIcon />}
					label="Always Accessible"
					color="success"
					size="small"
					variant="outlined"
				/>
			);
		}

		if (actions.size === 0 || (actions.size === 1 && actions.has("manage"))) {
			return null; // will render "No Access" below
		}

		// If "manage" is present, show a single Full Access chip
		if (actions.has("manage")) {
			return (
				<Chip
					icon={<CheckCircleIcon />}
					label="Full Access"
					color="success"
					size="small"
				/>
			);
		}

		const sorted = ["read", "create", "update", "delete"].filter((a) =>
			actions.has(a),
		);
		return (
			<Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
				{sorted.map((action) => (
					<Chip
						key={action}
						label={ACTION_LABELS[action] || action}
						color={ACTION_COLORS[action] || "default"}
						size="small"
					/>
				))}
			</Stack>
		);
	};

	return (
		<>
			<Paper
				elevation={3}
				sx={{
					p: 4,
					borderRadius: 2,
					background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
					color: "white",
					mb: 4,
				}}
			>
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						gap: 3,
						mb: 2,
					}}
				>
					<Avatar
						sx={{
							width: 50,
							height: 50,
							bgcolor: "white",
							color: "#667eea",
							fontSize: "2rem",
						}}
					>
						{profileData?.name?.charAt(0).toUpperCase() ||
							profileData?.username?.charAt(0).toUpperCase() ||
							"U"}
					</Avatar>
					<Box>
						<Typography
							variant="h4"
							component="h1"
							sx={{ fontWeight: "bold", color: "#FFFFFF" }}
						>
							{loading ? (
								<Skeleton width={200} />
							) : (
								profileData?.name || profileData?.username || "User"
							)}
						</Typography>
						<Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
							{loading ? (
								<Skeleton width={150} />
							) : (
								`@${profileData?.username || "username"}`
							)}
						</Typography>
					</Box>
				</Box>
			</Paper>

			{error && (
				<Alert severity="error" sx={{ mb: 3 }}>
					{error}
				</Alert>
			)}

			<Paper elevation={2} sx={{ p: 2, borderRadius: 2, mb: 3 }}>
				<Typography variant="h6" gutterBottom sx={{ color: "text.secondary" }}>
					Account Details
				</Typography>
				<Divider sx={{ mb: 2 }} />
				<List>
					<ListItem>
						<ListItemIcon>
							<PersonIcon color="primary" />
						</ListItemIcon>
						<ListItemText
							primary="Full Name"
							secondary={
								loading ? (
									<Skeleton width={150} />
								) : (
									profileData?.name || "Not set"
								)
							}
						/>
					</ListItem>
					<Divider component="li" />
					<ListItem>
						<ListItemIcon>
							<BadgeIcon color="primary" />
						</ListItemIcon>
						<ListItemText
							primary="Username"
							secondary={
								loading ? (
									<Skeleton width={150} />
								) : (
									profileData?.username || "N/A"
								)
							}
						/>
					</ListItem>
				</List>
			</Paper>

			<Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
				<Typography variant="h6" gutterBottom sx={{ color: "text.secondary" }}>
					Module Access
				</Typography>
				<Divider sx={{ mb: 2 }} />
				{loading ? (
					<List>
						{[...Array(6)].map((_, i) => (
							<ListItem key={i} divider={i < 5}>
								<ListItemIcon>
									<Skeleton variant="circular" width={24} height={24} />
								</ListItemIcon>
								<ListItemText
									primary={<Skeleton width={120} />}
									secondary={<Skeleton width={200} />}
								/>
							</ListItem>
						))}
					</List>
				) : permissions.length === 0 &&
				  permissionMap.size > 0 &&
				  !Array.from(permissionMap.values()).some((s) => s.size > 0) ? (
					<Box sx={{ py: 2, textAlign: "center" }}>
						<BlockIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
						<Typography color="text.secondary">
							No module access assigned yet. Contact an administrator.
						</Typography>
					</Box>
				) : (
					<List>
						{ALL_MODULES.map((module, i) => {
							const actions = permissionMap.get(module) ?? new Set();
							const isLast = i === ALL_MODULES.length - 1;

							return (
								<React.Fragment key={module}>
									<ListItem sx={{ py: 1.5 }}>
										<ListItemIcon>
											<SecurityIcon
												color={
													actions.has("manage") ||
													module === "Dashboard"
														? "success"
														: actions.size > 0
															? "primary"
															: "disabled"
												}
											/>
										</ListItemIcon>
										<ListItemText
											primary={module}
											secondary={renderActions(module, actions)}
											secondaryTypographyProps={{ component: "div" }}
											sx={{
												"& .MuiListItemText-secondary": {
													pt: 0.5,
												},
											}}
										/>
									</ListItem>
									{!isLast && <Divider component="li" />}
								</React.Fragment>
							);
						})}
					</List>
				)}
			</Paper>
		</>
	);
};

export default Profile;
