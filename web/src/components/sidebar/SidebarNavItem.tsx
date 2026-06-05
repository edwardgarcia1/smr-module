/**
 * SidebarNavItem — A single navigation item for the sidebar.
 */
import React from "react";
import {
	ListItemButton,
	ListItemIcon,
	ListItemText,
} from "@mui/material";
interface SidebarNavItemProps {
	icon: React.ReactNode;
	label: string;
	path: string;
	isActive: boolean;
	collapsed: boolean;
	onClick: (path: string) => void;
	getSx: (collapsed: boolean) => Record<string, unknown>;
}

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
	icon,
	label,
	path,
	isActive,
	collapsed,
	onClick,
	getSx,
}) => (
	<ListItemButton
		selected={isActive}
		onClick={() => onClick(path)}
		sx={getSx(collapsed)}
	>
		<ListItemIcon
			sx={{
				color: "var(--sidebar-icon)",
				minWidth: collapsed ? "auto" : 36,
			}}
		>
			{icon}
		</ListItemIcon>
		<ListItemText
			primary={label}
			sx={{
				fontSize: 13,
				display: collapsed ? "none" : "block",
			}}
		/>
	</ListItemButton>
);

export default SidebarNavItem;
