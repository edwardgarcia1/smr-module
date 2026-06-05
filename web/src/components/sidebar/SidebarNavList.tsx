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
	/** One or more CASL subjects — item visible when ANY grants read. */
	subjects?: string[];
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
		// Accepts either "Requirements" (PascalCase legacy) or
		// "purchasing-requirements" (kebab-case user-facing name).
		subjects: ["Requirements", "purchasing-requirements"],
	},
	{
		label: "Prices",
		path: "/prices",
		icon: <MoneyIcon sx={{ fontSize: 18 }} />,
		subjects: ["Prices", "prices"],
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
		subjects: ["PurchaseOrders", "purchase-orders"],
	},
	{
		label: "Inventory Items",
		path: "/inventory-items",
		icon: <InventoryIcon sx={{ fontSize: 18 }} />,
		subjects: ["InventoryItems", "inventory-items"],
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

/** Check if the ability allows `read` on at least one of the given subjects. */
function canReadAny(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	ability: any,
	subjects: string[] | undefined,
): boolean {
	if (!subjects || subjects.length === 0) return true;
	return subjects.some((s) => ability.can("read", s));
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

			// When multiple subjects are given, show the item if ANY grants read.
			const subjects = item.subjects ?? (item.subject ? [item.subject] : []);
			if (subjects.length > 1) {
				return canReadAny(ability, subjects)
					? renderNavItem(item, collapsed, isActive, onNav, getSx)
					: null;
			}

			const singleSubject = subjects[0];
			return (
				<Can
					key={item.path}
					I="read"
					a={singleSubject}
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
