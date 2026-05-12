// TypeScript types for Inventory and Component tables
// Inventory.InvtID = Component.KitID (join key)

export interface Inventory {
	InvtID: string;
	ClassID: string;
	ProdMgrID: string;
	Descr: string;
}

export type NewInventory = {
	InvtID: string;
	ClassID: string;
	ProdMgrID: string;
	Descr: string;
};

export type InventoryUpdate = Partial<
	Pick<Inventory, "ClassID" | "ProdMgrID" | "Descr">
>;

export interface Component {
	KitID: string;
	CmpnentID: string;
	CmpnentQty: number;
}

export type NewComponent = {
	KitID: string;
	CmpnentID: string;
	CmpnentQty: number;
};

export type ComponentUpdate = Partial<Pick<Component, "CmpnentQty">>;

/** Inventory with a promo flag — used by GET /item/inventory */
export interface InventoryWithPromo extends Inventory {
	isPromo: number; // 1 = promo (has Components), 0 = regular
}

/** Joined result of Inventory + Component on InvtID = KitID */
export interface InventoryWithComponent extends Inventory {
	KitID: string;
	CmpnentID: string;
	CmpnentQty: number;
}

// ─── ItemSite ─────────────────────────────────────────────────────────

export interface ItemSite {
	InvtID: string;
	SiteID: string;
	QtyCustOrd: number;
	QtyAlloc: number;
	QtyShipNotInv: number;
	QtyAllocIN: number;
	QtyOnPO: number;
	QtyAllocPORet: number;
	QtyAvail: number;
	QtyOnHand: number;
	TotCost: number;
	LUpd_DateTime: string;
}

export type NewItemSite = Omit<ItemSite, "LUpd_DateTime">;

export type ItemSiteUpdate = Partial<
	Omit<ItemSite, "InvtID" | "SiteID" | "LUpd_DateTime">
>;

/** Joined result of Inventory + ItemSite on InvtID */
export interface InventoryWithItemSite extends Inventory {
	SiteID: string;
	QtyCustOrd: number;
	QtyAlloc: number;
	QtyShipNotInv: number;
	QtyAllocIN: number;
	QtyOnPO: number;
	QtyAllocPORet: number;
	QtyAvail: number;
	QtyOnHand: number;
	TotCost: number;
	LUpd_DateTime: string;
}

/** Joined result of Inventory + Component + ItemSite on InvtID */
export interface InventoryWithComponentsAndItemSites extends Inventory {
	KitID: string;
	CmpnentID: string;
	CmpnentQty: number;
	SiteID: string;
	QtyCustOrd: number;
	QtyAlloc: number;
	QtyShipNotInv: number;
	QtyAllocIN: number;
	QtyOnPO: number;
	QtyAllocPORet: number;
	QtyAvail: number;
	QtyOnHand: number;
	TotCost: number;
	LUpd_DateTime: string;
}

/** MSSQL 2008 compatible DDL for Inventory table */
export const CREATE_INVENTORY_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Inventory' AND xtype='U')
BEGIN
  CREATE TABLE Inventory (
    InvtID NVARCHAR(30) NOT NULL,
    ClassID NVARCHAR(10),
    ProdMgrID NVARCHAR(10),
    Descr NVARCHAR(100),
    CONSTRAINT PK_Inventory PRIMARY KEY (InvtID)
  );
END
`;

/** MSSQL 2008 compatible DDL for ItemSite table */
export const CREATE_ITEMSITE_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ItemSite' AND xtype='U')
BEGIN
  CREATE TABLE ItemSite (
    InvtID NVARCHAR(30) NOT NULL,
    SiteID NVARCHAR(10) NOT NULL,
    QtyCustOrd NUMERIC(18, 4) NOT NULL DEFAULT 0,
    QtyAlloc NUMERIC(18, 4) NOT NULL DEFAULT 0,
    QtyShipNotInv NUMERIC(18, 4) NOT NULL DEFAULT 0,
    QtyAllocIN NUMERIC(18, 4) NOT NULL DEFAULT 0,
    QtyOnPO NUMERIC(18, 4) NOT NULL DEFAULT 0,
    QtyAllocPORet NUMERIC(18, 4) NOT NULL DEFAULT 0,
    QtyAvail NUMERIC(18, 4) NOT NULL DEFAULT 0,
    QtyOnHand NUMERIC(18, 4) NOT NULL DEFAULT 0,
    TotCost NUMERIC(18, 4) NOT NULL DEFAULT 0,
    LUpd_DateTime DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_ItemSite PRIMARY KEY (InvtID, SiteID)
  );
END
`;

/** MSSQL 2008 compatible DDL for Component table */
export const CREATE_COMPONENT_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Component' AND xtype='U')
BEGIN
  CREATE TABLE Component (
    KitID NVARCHAR(30) NOT NULL,
    CmpnentID NVARCHAR(30) NOT NULL,
    CmpnentQty NUMERIC(18, 4) NOT NULL DEFAULT 0,
    CONSTRAINT PK_Component PRIMARY KEY (KitID, CmpnentID)
  );
END
`;
