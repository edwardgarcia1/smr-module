/**
 * SidebarNavList — Renders all sidebar navigation items with CASL guards.
 * Uses SidebarNavItem for each link.
 */
import React from "react";
import { List } from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import AssignmentIcon from "@mui/icons-material/Assignment";
import MoneyIcon from "@mui/icons-material/Money";
import LowPriorityIcon from "@mui/icons-material/LowPriority";
import ShoppingBasketIcon from "@mui/icons-material/ShoppingBasket";
import InventoryIcon from "@mui/icons-material/Inventory";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import PeopleIcon from "@mui/icons-material/People";
import SettingsIcon from "@mui/icons-material/Settings";
import { Can } from "@casl/react";
import SidebarNavItem from "./SidebarNavItem";

interface NavItemDef {
	label: string;
	path: string;
	icon: React.ReactNode;
	/** CASL subject (defaults to label as identifier; use match string) */
	subject?: string;
	/** Use ability.can() instead of <Can> (for non-subject checks) */
	useAbilityCheck?: boolean;
}

const NAV_ITEMS: NavItemDef[] = [
	{
		label: "Dashboard",
		path: "/",
		icon: <DashboardIcon sx={{ fontSize: 18 }} />,
		useAbilityCheck: true, // always visible
	},
	{
		label: "Requirements",
		path: "/purchasing-requirements",
		icon: <AssignmentIcon sx={{ fontSize: 18 }} />,
		subject: "Requirements",
	},
	{
		label: "Prices",
		path: "/prices",
		icon: <MoneyIcon sx={{ fontSize: 18 }} />,
		subject: "Prices",
	},
	{
		label: "Min Stock",
		path: "/min-stock",
		icon: <LowPriorityIcon sx={{ fontSize: 18 }} />,
		subject: "MinStock",
	},
	{
		label: "Purchase Orders",
		path: "/purchase-orders",
		icon: <ShoppingBasketIcon sx={{ fontSize: 18 }} />,
		subject: "PurchaseOrders",
	},
	{
		label: "Inventory Items",
		path: "/inventory-items",
		icon: <InventoryIcon sx={{ fontSize: 18 }} />,
		subject: "InventoryItems",
	},
	{
		label: "Principals",
		path: "/principals",
		icon: <LocalShippingIcon sx={{ fontSize: 18 }} />,
		subject: "Principals",
	},
	{
		label: "Users",
		path: "/users",
		icon: <PeopleIcon sx={{ fontSize: 18 }} />,
		subject: "Users",
	},
	{
		label: "Settings",
		path: "/settings",
		icon: <SettingsIcon sx={{ fontSize: 18 }} />,
		subject: "Settings",
	},
];

interface SidebarNavListProps {
	collapsed: boolean;
	isActive: (path: string) => boolean;
	onNav: (path: string) => void;
	getSx: (collapsed: boolean) => Record<string, unknown>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	ability: any;
}

function renderNavItem(
	item: NavItemDef,
	collapsed: boolean,
	isActive: (path: string) => boolean,
	onNav: (path: string) => void,
	getSx: (collapsed: boolean) => Record<string, unknown>,
): React.ReactNode {
	return (
		<SidebarNavItem
			key={item.path}
			icon={item.icon}
			label={item.label}
			path={item.path}
			isActive={isActive(item.path)}
			collapsed={collapsed}
			onClick={onNav}
			getSx={getSx}
		/>
	);
}

const SidebarNavList: React.FC<SidebarNavListProps> = ({
	collapsed,
	isActive,
	onNav,
	getSx,
	ability,
}) => (
	<List sx={{ flexGrow: 1, overflowY: "auto", overflowX: "hidden" }}>
		{NAV_ITEMS.map((item) => {
			if (item.useAbilityCheck) {
				return renderNavItem(
					item,
					collapsed,
					isActive,
					onNav,
					getSx,
				);
			}
			return (
				<Can
					key={item.path}
					I="read"
					a={item.subject}
					ability={ability}
				>
					{renderNavItem(
						item,
						collapsed,
						isActive,
						onNav,
						getSx,
					)}
				</Can>
			);
		})}
	</List>
);

export default SidebarNavList;
