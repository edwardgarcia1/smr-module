// TypeScript types for the SMR_Users table (MSSQL 2008)
// This module describes the table structure; actual DDL is in migrate.ts.

export interface User {
  id: number;
  username: string;
  password: string;
  name: string;
}

export type NewUser = {
  username: string;
  password: string;
  name: string;
};

/** MSSQL 2008 compatible DDL for SMR_Users table */
export const CREATE_USERS_TABLE_SQL = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SMR_Users' AND xtype='U')
BEGIN
  CREATE TABLE SMR_Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) NOT NULL,
    password NVARCHAR(255) NOT NULL,
    name NVARCHAR(100) NOT NULL,
    CONSTRAINT UQ_SMR_Users_username UNIQUE (username)
  );
END
`;
