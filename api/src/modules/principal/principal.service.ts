import { withTenantDb } from "../../config/with-tenant-db";
import { BadRequestError, NotFoundError } from "../../middlewares/error";
import { trimStrings } from "../../utils/trimStrings";
import type {
	ProductClass,
	NewProductClass,
	ProductClassUpdate,
	Vendor,
	NewVendor,
	VendorUpdate,
	ProductClassWithVendor,
} from "./principal.schema";

// ─── ProductClass CRUD ───────────────────────────────────────────────

export const createProductClass = async (
	pc: NewProductClass,
	tenantKey = "default",
): Promise<ProductClass> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("ClassID", pc.ClassID)
			.input("Descr", pc.Descr)
			.input("User5", pc.User5).query(`
        INSERT INTO ProductClass (ClassID, Descr, User5)
        OUTPUT INSERTED.ClassID, INSERTED.Descr, INSERTED.User5
        VALUES (@ClassID, @Descr, @User5)
      `),
	);

	const created = result.recordset[0];
	if (!created) throw new Error("Failed to create ProductClass");
	return trimStrings(created as ProductClass);
};

export const getProductClassById = async (
	classId: string,
	tenantKey = "default",
): Promise<ProductClass | undefined> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("ClassID", classId)
			.query(
				"SELECT ClassID, Descr, User5 FROM ProductClass WHERE ClassID = @ClassID",
			),
	);
	return trimStrings(result.recordset[0] as ProductClass | undefined);
};

export const getAllProductClasses = async (tenantKey = "default"): Promise<ProductClass[]> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.query("SELECT ClassID, Descr, User5 FROM ProductClass"),
	);
	return trimStrings(result.recordset as ProductClass[]);
};

export const updateProductClass = async (
	classId: string,
	updates: ProductClassUpdate,
	tenantKey = "default",
): Promise<ProductClass> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("ClassID", classId)
			.input("Descr", updates.Descr ?? null)
			.input("User5", updates.User5 ?? null).query(`
        UPDATE ProductClass
        SET Descr = @Descr, User5 = @User5
        OUTPUT INSERTED.ClassID, INSERTED.Descr, INSERTED.User5
        WHERE ClassID = @ClassID
      `),
	);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`ProductClass ${classId} not found`);
	}
	return trimStrings(result.recordset[0] as ProductClass);
};

export const deleteProductClass = async (classId: string, tenantKey = "default"): Promise<void> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("ClassID", classId)
			.query(
				"DELETE FROM ProductClass OUTPUT DELETED.ClassID WHERE ClassID = @ClassID",
			),
	);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`ProductClass ${classId} not found`);
	}
};

// ─── Vendor CRUD ─────────────────────────────────────────────────────

export const createVendor = async (vendor: NewVendor, tenantKey = "default"): Promise<Vendor> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("VendId", vendor.VendId)
			.input("Addr1", vendor.Addr1)
			.input("Addr2", vendor.Addr2)
			.input("City", vendor.City)
			.input("Terms", vendor.Terms).query(`
        INSERT INTO Vendor (VendId, Addr1, Addr2, City, Terms)
        OUTPUT INSERTED.VendId, INSERTED.Addr1, INSERTED.Addr2, INSERTED.City, INSERTED.Terms
        VALUES (@VendId, @Addr1, @Addr2, @City, @Terms)
      `),
	);

	const created = result.recordset[0];
	if (!created) throw new Error("Failed to create Vendor");
	return trimStrings(created as Vendor);
};

export const getVendorById = async (
	venId: string,
	tenantKey = "default",
): Promise<Vendor | undefined> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("VendId", venId)
			.query(
				"SELECT VendId, Addr1, Addr2, City, Terms FROM Vendor WHERE VendId = @VendId",
			),
	);
	return trimStrings(result.recordset[0] as Vendor | undefined);
};

export const getAllVendors = async (tenantKey = "default"): Promise<Vendor[]> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.query("SELECT VendId, Addr1, Addr2, City, Terms FROM Vendor"),
	);
	return trimStrings(result.recordset as Vendor[]);
};

export const updateVendor = async (
	venId: string,
	updates: VendorUpdate,
	tenantKey = "default",
): Promise<Vendor> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("VendId", venId)
			.input("Addr1", updates.Addr1 ?? null)
			.input("Addr2", updates.Addr2 ?? null)
			.input("City", updates.City ?? null)
			.input("Terms", updates.Terms ?? null).query(`
        UPDATE Vendor
        SET Addr1 = @Addr1, Addr2 = @Addr2, City = @City, Terms = @Terms
        OUTPUT INSERTED.VendId, INSERTED.Addr1, INSERTED.Addr2, INSERTED.City, INSERTED.Terms
        WHERE VendId = @VendId
      `),
	);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`Vendor ${venId} not found`);
	}
	return trimStrings(result.recordset[0] as Vendor);
};

export const deleteVendor = async (venId: string, tenantKey = "default"): Promise<void> => {
	const result = await withTenantDb(tenantKey, (pool) =>
		pool
			.request()
			.input("VendId", venId)
			.query(
				"DELETE FROM Vendor OUTPUT DELETED.VendId WHERE VendId = @VendId",
			),
	);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`Vendor ${venId} not found`);
	}
};

// ─── Joined query ────────────────────────────────────────────────────

export const getProductClassesWithVendors =
	async (tenantKey = "default"): Promise<ProductClassWithVendor[]> => {
		const result = await withTenantDb(tenantKey, (pool) => pool.request().query(`
      SELECT
        pc.ClassID, pc.Descr, pc.User5,
        v.VendId,
        v.Addr1 AS VendorAddr1,
        v.Addr2 AS VendorAddr2,
        v.City AS VendorCity,
        v.Terms AS VendorTerms
      FROM ProductClass pc
      LEFT JOIN Vendor v ON pc.User5 = v.VendId
      ORDER BY pc.ClassID
    `));
		return trimStrings(result.recordset as ProductClassWithVendor[]);
	};
