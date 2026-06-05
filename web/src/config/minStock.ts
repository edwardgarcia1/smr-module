/**
 * Min Stock feature: types and shared constants.
 * Extracted from the monolithic MinStock.tsx.
 */

// ─── Types matching backend merged responses ────────────────────────

export interface PrincipalWithMinStockDetails {
	ClassID: string;
	Descr: string;
	User5: string;
	VendId: string;
	VendorAddr1: string;
	VendorAddr2: string;
	VendorCity: string;
	VendorTerms: string;
	minStock: number;
	minStockId: number | null;
}

export interface ItemWithMinStockDetails {
	InvtID: string;
	ClassID: string;
	Descr: string;
	setting: "Custom" | "Principal" | "Default";
	minStock: number;
	minStockSettingId: number | null;
	minStockItemId: number | null;
}

export type ItemSetting = ItemWithMinStockDetails["setting"];

export const SETTING_OPTIONS: ItemSetting[] = ["Custom", "Principal", "Default"];

export const SETTING_COLORS: Record<ItemSetting, "primary" | "warning" | "default"> = {
	Custom: "primary",
	Principal: "warning",
	Default: "default",
};

// ─── MinStockCategory type ───────────────────────────────────────────

export interface CategoryRow {
	id: number;
	category_name: string;
	threshold: number | null;
}
