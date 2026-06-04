// ─── MinStockSetting ───────────────────────────────────────────────────
// Master setting per inventory item — determines which min stock source to use.
//   min_stock_setting IN ('Custom', 'Principal', 'Default') — never null.

export type MinStockSettingValue = "Custom" | "Principal" | "Default";

export interface MinStockSetting {
	id: number;
	inventory_id: string;
	class_id: string;
	min_stock_setting: MinStockSettingValue;
}

export type NewMinStockSetting = {
	inventory_id: string;
	class_id: string;
	min_stock_setting: MinStockSettingValue;
};

export type MinStockSettingUpdate = {
	min_stock_setting: MinStockSettingValue;
};

// ─── MinStockItem ──────────────────────────────────────────────────────
// Per-item min stock values. Used when setting = 'Custom'.
// Special row: inventory_id = 'Default' with min_stock = 1.0 for fallback.

export interface MinStockItem {
	id: number;
	inventory_id: string;
	min_stock: number;
}

export type NewMinStockItem = {
	inventory_id: string;
	min_stock: number;
};

export type MinStockItemUpdate = {
	min_stock: number;
};

// ─── MinStockPrincipal ─────────────────────────────────────────────────
// Per-class min stock values. Used when setting = 'Principal'.

export interface MinStockPrincipal {
	id: number;
	class_id: string;
	min_stock: number;
}

export type NewMinStockPrincipal = {
	class_id: string;
	min_stock: number;
};

export type MinStockPrincipalUpdate = {
	min_stock: number;
};

// ─── Resolved min stock ────────────────────────────────────────────────
// Result of resolving effective min stock for an item.

export interface ResolvedMinStock {
	invtID: string;
	classID: string;
	minStock: number;
	source: "custom" | "principal" | "default";
	setting: MinStockSettingValue;
}

// ─── Merged (Principal + MinStock) ─────────────────────────────────────
// ProductClassWithVendor + MinStockPrincipal joined in service layer.

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

// ─── Merged (Inventory + MinStockSetting + MinStockItem) ────────────────
// Inventory basic fields + setting + value joined in service layer.

export interface ItemWithMinStockDetails {
	InvtID: string;
	ClassID: string;
	Descr: string;
	setting: MinStockSettingValue;
	minStock: number;
	minStockSettingId: number | null;
	minStockItemId: number | null;
}

// ─── MinStockCategory ──────────────────────────────────────────────────
// Defines categorisation thresholds for stock cover / min stock ratio.
//   ratio = stockCoverCount / coverageThreshold
//   Categories checked in threshold ASC order:
//     ratio < threshold  → this category
//     no match           → last category (Overstocked, threshold=NULL)

export interface MinStockCategory {
	id: number;
	category_name: string;
	threshold: number | null;
}

export type MinStockCategoryUpdate = {
	threshold: number | null;
};

// ─── DDL ───────────────────────────────────────────────────────────────

export const CREATE_MIN_STOCK_SETTING_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SMR_MinStockSetting' AND xtype='U')
BEGIN
  CREATE TABLE SMR_MinStockSetting (
    id BIGINT IDENTITY(1,1) NOT NULL,
    inventory_id NVARCHAR(30) NOT NULL,
    class_id NVARCHAR(10) NOT NULL,
    min_stock_setting NVARCHAR(10) NOT NULL DEFAULT 'Default',
    CONSTRAINT PK_SMR_MinStockSetting PRIMARY KEY (id),
    CONSTRAINT UQ_SMR_MinStockSetting_inventory UNIQUE (inventory_id),
    CONSTRAINT CK_SMR_MinStockSetting_value CHECK (min_stock_setting IN ('Custom', 'Principal', 'Default'))
  );
END
`;

export const CREATE_MIN_STOCK_ITEM_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SMR_MinStockItem' AND xtype='U')
BEGIN
  CREATE TABLE SMR_MinStockItem (
    id BIGINT IDENTITY(1,1) NOT NULL,
    inventory_id NVARCHAR(30) NOT NULL,
    min_stock NUMERIC(9,4) NOT NULL DEFAULT 0,
    CONSTRAINT PK_SMR_MinStockItem PRIMARY KEY (id),
    CONSTRAINT UQ_SMR_MinStockItem_inventory UNIQUE (inventory_id)
  );
END
`;

export const CREATE_MIN_STOCK_PRINCIPAL_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SMR_MinStockPrincipal' AND xtype='U')
BEGIN
  CREATE TABLE SMR_MinStockPrincipal (
    id BIGINT IDENTITY(1,1) NOT NULL,
    class_id NVARCHAR(10) NOT NULL,
    min_stock NUMERIC(9,4) NOT NULL DEFAULT 0,
    CONSTRAINT PK_SMR_MinStockPrincipal PRIMARY KEY (id),
    CONSTRAINT UQ_SMR_MinStockPrincipal_class UNIQUE (class_id)
  );
END
`;

/** Seed the default min stock row used when setting = 'Default' */
export const SEED_DEFAULT_MIN_STOCK_SQL = `
IF NOT EXISTS (SELECT 1 FROM SMR_MinStockItem WHERE inventory_id = 'Default')
BEGIN
  INSERT INTO SMR_MinStockItem (inventory_id, min_stock) VALUES ('Default', 1.0);
END
`;

// ─── SMR_Categories ────────────────────────────────────────────────────

export const CREATE_MIN_STOCK_CATEGORY_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SMR_MinStockCategory' AND xtype='U')
BEGIN
  CREATE TABLE SMR_MinStockCategory (
    id BIGINT IDENTITY(1,1) NOT NULL,
    category_name NVARCHAR(50) NOT NULL,
    threshold NUMERIC(5,2) NULL,
    CONSTRAINT PK_SMR_MinStockCategory PRIMARY KEY (id),
    CONSTRAINT UQ_SMR_MinStockCategory_name UNIQUE (category_name)
  );
END
`;

/**
 * Seed categories for stock cover / min stock ratio categorisation.
 *   ratio = stockCoverCount / coverageThreshold
 *   Immediate (Red):   ratio < 1.00   → below 100% of min stock
 *   Secondary (Yellow): ratio < 1.50  → 100% – 149%
 *   Monitoring (Blue):  ratio < 2.00  → 150% – 199%
 *   Overstocked (Green): ratio >= 2.00 → 200% and over (threshold=NULL)
 */
export const SEED_MIN_STOCK_CATEGORIES_SQL = `
IF NOT EXISTS (SELECT 1 FROM SMR_MinStockCategory WHERE category_name = 'Immediate')
  INSERT INTO SMR_MinStockCategory (category_name, threshold) VALUES ('Immediate', 1.00);
IF NOT EXISTS (SELECT 1 FROM SMR_MinStockCategory WHERE category_name = 'Secondary')
  INSERT INTO SMR_MinStockCategory (category_name, threshold) VALUES ('Secondary', 1.50);
IF NOT EXISTS (SELECT 1 FROM SMR_MinStockCategory WHERE category_name = 'Monitoring')
  INSERT INTO SMR_MinStockCategory (category_name, threshold) VALUES ('Monitoring', 2.00);
IF NOT EXISTS (SELECT 1 FROM SMR_MinStockCategory WHERE category_name = 'Overstocked')
  INSERT INTO SMR_MinStockCategory (category_name, threshold) VALUES ('Overstocked', NULL);
`;
