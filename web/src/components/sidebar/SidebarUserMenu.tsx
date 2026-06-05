/**
 * SidebarUserMenu — User info footer with popover menu and logout dialog.
 */
import React, { useRef, useState } from "react";
import {
	Box,
	List,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	Typography,
	Popover,
	Divider,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogContentText,
	DialogActions,
	Button,
} from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import type { User } from "../../store/useAuthStore";

interface SidebarUserMenuProps {
	collapsed: boolean;
	user: User | null;
	getSx: (collapsed: boolean) => Record<string, unknown>;
	onNav: (path: string) => void;
	onLogout: () => void;
}

const SidebarUserMenu: React.FC<SidebarUserMenuProps> = ({
	collapsed,
	user,
	getSx,
	onNav,
	onLogout,
}) => {
	const [userMenuAnchor, setUserMenuAnchor] =
		useState<HTMLElement | null>(null);
	const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
	const userMenuTriggerRef = useRef<HTMLDivElement>(null);

	const handleUserMenuClick = (e: React.MouseEvent<HTMLElement>) => {
		setUserMenuAnchor(e.currentTarget);
	};

	const handleUserMenuClose = () => {
		setUserMenuAnchor(null);
	};

	const handleLogoutClick = () => {
		setUserMenuAnchor(null);
		setLogoutDialogOpen(true);
	};

	const handleLogoutConfirm = () => {
		setLogoutDialogOpen(false);
		onLogout();
	};

	const handleLogoutCancel = () => {
		setLogoutDialogOpen(false);
	};

	const userMenuOpen = Boolean(userMenuAnchor);

	return (
		<Box sx={{ flexShrink: 0, bgcolor: "var(--sidebar-bg)" }}>
			<Divider
				sx={{ borderColor: "var(--sidebar-text)", opacity: 0.2 }}
			/>
			<Box ref={userMenuTriggerRef}>
				<ListItemButton
					onClick={handleUserMenuClick}
					sx={{
						...getSx(collapsed),
						mx: 0,
						borderRadius: 0,
						px: 2,
						justifyContent: "flex-start",
						py: collapsed ? 1.5 : 1,
					}}
				>
					<ListItemIcon
						sx={{
							color: "var(--sidebar-icon)",
							minWidth: collapsed ? "auto" : 28,
						}}
					>
						<AccountCircleIcon sx={{ fontSize: 18 }} />
					</ListItemIcon>
					<Box
						sx={{
							overflow: "hidden",
							display: collapsed ? "none" : "block",
						}}
					>
						<Typography
							variant="body2"
							sx={{
								fontWeight: "bold",
								fontSize: 12,
								color: "var(--sidebar-text)",
							}}
						>
							{user?.name || user?.username || "User"}
						</Typography>
						{user?.username && (
							<Typography
								variant="caption"
								sx={{
									fontSize: 10,
									color: "var(--sidebar-text)",
								}}
							>
								@{user.username}
							</Typography>
						)}
					</Box>
				</ListItemButton>
				<Popover
					open={userMenuOpen}
					anchorEl={userMenuAnchor}
					onClose={handleUserMenuClose}
					anchorOrigin={{
						vertical: "top",
						horizontal: "right",
					}}
					transformOrigin={{
						vertical: "top",
						horizontal: "left",
					}}
					slotProps={{
						paper: {
							sx: {
								bgcolor: "var(--sidebar-bg)",
								color: "var(--sidebar-text)",
								minWidth: 180,
								mt: 0.5,
							},
						},
					}}
				>
					<List disablePadding>
						<ListItemButton
							onClick={() => {
								handleUserMenuClose();
								onNav("/profile");
							}}
							sx={getSx(false)}
						>
							<ListItemIcon
								sx={{
									color: "var(--sidebar-icon)",
									minWidth: 36,
								}}
							>
								<AccountCircleIcon sx={{ fontSize: 18 }} />
							</ListItemIcon>
							<ListItemText primary="Profile" sx={{ fontSize: 13 }} />
						</ListItemButton>
						<ListItemButton
							onClick={handleLogoutClick}
							sx={getSx(false)}
						>
							<ListItemIcon
								sx={{
									color: "var(--sidebar-icon)",
									minWidth: 36,
								}}
							>
								<LogoutIcon sx={{ fontSize: 18 }} />
							</ListItemIcon>
							<ListItemText primary="Logout" sx={{ fontSize: 13 }} />
						</ListItemButton>
					</List>
				</Popover>
			</Box>
			<Dialog
				open={logoutDialogOpen}
				onClose={handleLogoutCancel}
				aria-labelledby="logout-dialog-title"
				aria-describedby="logout-dialog-description"
			>
				<DialogTitle id="logout-dialog-title">Confirm Logout</DialogTitle>
				<DialogContent>
					<DialogContentText id="logout-dialog-description">
						Are you sure you want to logout?
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleLogoutCancel}>Cancel</Button>
					<Button
						onClick={handleLogoutConfirm}
						color="error"
						autoFocus
					>
						Logout
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};

export default SidebarUserMenu;
