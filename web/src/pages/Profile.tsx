import React, { useEffect, useState } from "react";
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
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import BadgeIcon from "@mui/icons-material/Badge";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { useAuthStore } from "../store/useAuthStore";

interface UserProfile {
	id: string;
	username: string;
	name: string;
	email?: string;
	role: string;
	createdAt?: string;
	updatedAt?: string;
}

const Profile: React.FC = () => {
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const authUser = useAuthStore((state) => state.user);

	useEffect(() => {
		const fetchProfile = async () => {
			try {
				const response = await fetch(
					`${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/api/users/profile`,
					{
						method: "GET",
						credentials: "include",
						headers: {
							"Content-Type": "application/json",
						},
					},
				);

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					throw new Error(
						errorData.error || errorData.message || "Failed to fetch profile",
					);
				}

				const data = await response.json();
				setProfile(data);
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to fetch profile",
				);
			} finally {
				setLoading(false);
			}
		};

		fetchProfile();
	}, []);

	const profileData = profile || authUser;

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

			<Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
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
					<Divider component="li" />
					<ListItem>
						<ListItemIcon>
							<AdminPanelSettingsIcon color="primary" />
						</ListItemIcon>
						<ListItemText
							primary="Role"
							secondary={
								loading ? <Skeleton width={100} /> : profileData?.role || "N/A"
							}
						/>
					</ListItem>
				</List>
			</Paper>
		</>
	);
};

export default Profile;
