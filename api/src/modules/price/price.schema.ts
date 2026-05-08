// TypeScript types for SlsPrc and SlsPrcDet tables
// SlsPrc.SlsPrcID = SlsPrcDet.SlsPrcID (join key)

export interface SlsPrc {
	SlsPrcID: string;
	InvtID: string;
	CatalogNbr: string;
}

export type NewSlsPrc = {
	SlsPrcID: string;
	InvtID: string;
	CatalogNbr: string;
};

export type SlsPrcUpdate = Partial<Pick<SlsPrc, "InvtID" | "CatalogNbr">>;

export interface SlsPrcDet {
	SlsPrcID: string;
	DiscPrice: number;
	SlsUnit: string;
}

export type NewSlsPrcDet = {
	SlsPrcID: string;
	DiscPrice: number;
	SlsUnit: string;
};

export type SlsPrcDetUpdate = Partial<Pick<SlsPrcDet, "DiscPrice" | "SlsUnit">>;

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

/** Joined result of SlsPrc + SlsPrcDet on SlsPrcID + Inventory on InvtID */
export interface SlsPrcWithDet extends SlsPrc {
	DiscPrice: number | null;
	SlsUnit: string | null;
	Descr: string | null;
}

/** MSSQL 2008 compatible DDL for SlsPrc table */
export const CREATE_SLSPRC_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SlsPrc' AND xtype='U')
BEGIN
  CREATE TABLE SlsPrc (
    SlsPrcID NVARCHAR(30) NOT NULL,
    InvtID NVARCHAR(30),
    CatalogNbr NVARCHAR(50),
    CONSTRAINT PK_SlsPrc PRIMARY KEY (SlsPrcID)
  );
END
`;

/** MSSQL 2008 compatible DDL for SlsPrcDet table */
export const CREATE_SLSPRCDET_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SlsPrcDet' AND xtype='U')
BEGIN
  CREATE TABLE SlsPrcDet (
    SlsPrcID NVARCHAR(30) NOT NULL,
    DiscPrice NUMERIC(18, 4) NOT NULL DEFAULT 0,
    SlsUnit NVARCHAR(10)
  );
END
`;
