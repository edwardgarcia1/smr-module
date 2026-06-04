// TypeScript types for the SMR_Permissions table

export type PermissionAction = "create" | "read" | "update" | "delete" | "manage";

export interface Permission {
	id: number;
	userId: number;
	subject: string;
	action: PermissionAction;
}

export type NewPermission = Omit<Permission, "id">;

/** MSSQL 2008 compatible DDL for SMR_Permissions table */
export const CREATE_PERMISSIONS_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SMR_Permissions' AND xtype='U')
BEGIN
  CREATE TABLE SMR_Permissions (
    id        INT IDENTITY(1,1) PRIMARY KEY,
    user_id   INT NOT NULL,
    subject   NVARCHAR(50) NOT NULL,
    action    NVARCHAR(20) NOT NULL,
    CONSTRAINT FK_Permissions_User FOREIGN KEY (user_id) REFERENCES SMR_Users(id) ON DELETE CASCADE,
    CONSTRAINT UQ_Permissions_user_subject_action UNIQUE (user_id, subject, action)
  );
END
`;

/** Shared INSERT SQL constant — keep in sync with table schema */
export const INSERT_PERMISSION_SQL = `INSERT INTO SMR_Permissions (user_id, subject, action) VALUES (@userId, @subject, @action)`;
