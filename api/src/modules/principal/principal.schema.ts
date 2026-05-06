// TypeScript types for ProductClass and Vendor tables
// ProductClass.User5 = Vendor.VendId (join key)

export interface ProductClass {
	ClassID: string;
	Descr: string;
	User5: string;
}

export type NewProductClass = {
	ClassID: string;
	Descr: string;
	User5: string;
};

export type ProductClassUpdate = Partial<Pick<ProductClass, "Descr" | "User5">>;

export interface Vendor {
	VendId: string;
	Addr1: string;
	Addr2: string;
	City: string;
	Terms: string;
}

export type NewVendor = {
	VendId: string;
	Addr1: string;
	Addr2: string;
	City: string;
	Terms: string;
};

export type VendorUpdate = Partial<
	Pick<Vendor, "Addr1" | "Addr2" | "City" | "Terms">
>;

/** Joined result of ProductClass + Vendor on User5 = VendId */
export interface ProductClassWithVendor extends ProductClass {
	VendId: string;
	VendorAddr1: string;
	VendorAddr2: string;
	VendorCity: string;
	VendorTerms: string;
}

/** MSSQL 2008 compatible DDL for ProductClass table */
export const CREATE_PRODUCTCLASS_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ProductClass' AND xtype='U')
BEGIN
  CREATE TABLE ProductClass (
    ClassID NVARCHAR(10) NOT NULL,
    Descr NVARCHAR(100),
    User5 NVARCHAR(10),
    CONSTRAINT PK_ProductClass PRIMARY KEY (ClassID)
  );
END
`;

/** MSSQL 2008 compatible DDL for Vendor table */
export const CREATE_VENDOR_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Vendor' AND xtype='U')
BEGIN
  CREATE TABLE Vendor (
    VendId NVARCHAR(10) NOT NULL,
    Addr1 NVARCHAR(100),
    Addr2 NVARCHAR(100),
    City NVARCHAR(50),
    Terms NVARCHAR(50),
    CONSTRAINT PK_Vendor PRIMARY KEY (VendId)
  );
END
`;
