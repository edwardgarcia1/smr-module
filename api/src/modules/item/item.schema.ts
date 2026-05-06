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

/** Joined result of Inventory + Component on InvtID = KitID */
export interface InventoryWithComponent extends Inventory {
	KitID: string;
	CmpnentID: string;
	CmpnentQty: number;
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
