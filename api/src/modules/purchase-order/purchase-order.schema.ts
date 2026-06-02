// ─── SMR_PurchaseOrders ───────────────────────────────────────────────
// Stores saved purchase order snapshots from the Requirements purchasing grid.
// Each row captures the filter state + a CSV file with the generated grid data.

export interface PurchaseOrder {
	id: number;
	ref_num: string;
	principal_id: string;
	site_id: string;
	demand_mode: string;
	frequency: string;
	sales_from: string;
	sales_to: string;
	csv_filename: string | null;
	created_at: string;
	prepared_by: string;
	last_update_at: string | null;
	last_update_by: string | null;
}

export type NewPurchaseOrder = {
	ref_num: string;
	principal_id: string;
	site_id: string;
	demand_mode: string;
	frequency: string;
	sales_from: string;
	sales_to: string;
	prepared_by: string;
};

// ─── DDL ───────────────────────────────────────────────────────────────

export const CREATE_PURCHASE_ORDERS_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SMR_PurchaseOrders' AND xtype='U')
BEGIN
  CREATE TABLE SMR_PurchaseOrders (
    id BIGINT IDENTITY(1,1) NOT NULL,
    ref_num NVARCHAR(100) NOT NULL,
    principal_id NVARCHAR(100) NOT NULL,
    site_id NVARCHAR(100) NOT NULL,
    demand_mode NVARCHAR(20) NOT NULL,
    frequency NVARCHAR(20) NOT NULL,
    sales_from DATE NOT NULL,
    sales_to DATE NOT NULL,
    csv_filename NVARCHAR(255) NULL,
    prepared_by NVARCHAR(100) NOT NULL DEFAULT '',
    last_update_at DATETIME2 NULL,
    last_update_by NVARCHAR(100) NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_SMR_PurchaseOrders PRIMARY KEY (id)
  );
END
`;
