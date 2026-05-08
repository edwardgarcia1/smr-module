import { getDb } from "../../config/db";
import { NotFoundError } from "../../middlewares/error";
import { trimStrings } from "../../utils/trimStrings";
import type {
	Inventory,
	NewInventory,
	InventoryUpdate,
	Component,
	NewComponent,
	ComponentUpdate,
	InventoryWithComponent,
	InventoryWithPromo,
} from "./item.schema";

// ─── Inventory CRUD ──────────────────────────────────────────────────

export const createInventory = async (
	inv: NewInventory,
): Promise<Inventory> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("InvtID", inv.InvtID)
		.input("ClassID", inv.ClassID)
		.input("ProdMgrID", inv.ProdMgrID)
		.input("Descr", inv.Descr).query(`
      INSERT INTO Inventory (InvtID, ClassID, ProdMgrID, Descr)
      OUTPUT INSERTED.InvtID, INSERTED.ClassID, INSERTED.ProdMgrID, INSERTED.Descr
      VALUES (@InvtID, @ClassID, @ProdMgrID, @Descr)
    `);

	const created = result.recordset[0];
	if (!created) throw new Error("Failed to create Inventory");
	return trimStrings(created as Inventory);
};

export const getInventoryById = async (
	invtId: string,
): Promise<Inventory | undefined> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("InvtID", invtId)
		.query(
			"SELECT InvtID, ClassID, ProdMgrID, Descr FROM Inventory WHERE InvtID = @InvtID",
		);
	return trimStrings(result.recordset[0] as Inventory | undefined);
};

export const getAllInventory = async (
	promoFilter: "all" | "promos" | "non_promos" = "all",
): Promise<InventoryWithPromo[]> => {
	const pool = await getDb();
	const baseSelect = `SELECT i.InvtID, i.ClassID, i.ProdMgrID, i.Descr`;

	const query =
		promoFilter === "all"
			? `${baseSelect},
			   CASE WHEN EXISTS (SELECT 1 FROM Component c WHERE c.KitID = i.InvtID) THEN 1 ELSE 0 END AS isPromo
			 FROM Inventory i`
			: promoFilter === "promos"
				? `${baseSelect},
				   1 AS isPromo
				 FROM Inventory i
				 WHERE EXISTS (SELECT 1 FROM Component c WHERE c.KitID = i.InvtID)`
				: /* "non_promos" */ `${baseSelect},
				   0 AS isPromo
				 FROM Inventory i
				 WHERE NOT EXISTS (SELECT 1 FROM Component c WHERE c.KitID = i.InvtID)`;
	const result = await pool.request().query(query);
	return trimStrings(result.recordset as InventoryWithPromo[]);
};

export const updateInventory = async (
	invtId: string,
	updates: InventoryUpdate,
): Promise<Inventory> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("InvtID", invtId)
		.input("ClassID", updates.ClassID ?? null)
		.input("ProdMgrID", updates.ProdMgrID ?? null)
		.input("Descr", updates.Descr ?? null).query(`
      UPDATE Inventory
      SET ClassID = @ClassID, ProdMgrID = @ProdMgrID, Descr = @Descr
      OUTPUT INSERTED.InvtID, INSERTED.ClassID, INSERTED.ProdMgrID, INSERTED.Descr
      WHERE InvtID = @InvtID
    `);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`Inventory ${invtId} not found`);
	}
	return trimStrings(result.recordset[0] as Inventory);
};

export const deleteInventory = async (invtId: string): Promise<void> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("InvtID", invtId)
		.query(
			"DELETE FROM Inventory OUTPUT DELETED.InvtID WHERE InvtID = @InvtID",
		);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`Inventory ${invtId} not found`);
	}
};

// ─── Component CRUD ──────────────────────────────────────────────────

export const createComponent = async (
	comp: NewComponent,
): Promise<Component> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("KitID", comp.KitID)
		.input("CmpnentID", comp.CmpnentID)
		.input("CmpnentQty", comp.CmpnentQty).query(`
      INSERT INTO Component (KitID, CmpnentID, CmpnentQty)
      OUTPUT INSERTED.KitID, INSERTED.CmpnentID, INSERTED.CmpnentQty
      VALUES (@KitID, @CmpnentID, @CmpnentQty)
    `);

	const created = result.recordset[0];
	if (!created) throw new Error("Failed to create Component");
	return created as Component;
};

export const getComponentById = async (
	kitId: string,
	cmpnentId: string,
): Promise<Component | undefined> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("KitID", kitId)
		.input("CmpnentID", cmpnentId)
		.query(
			"SELECT KitID, CmpnentID, CmpnentQty FROM Component WHERE KitID = @KitID AND CmpnentID = @CmpnentID",
		);
	return trimStrings(result.recordset[0] as Component | undefined);
};

export const getComponentsByKitId = async (
	kitId: string,
): Promise<Component[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("KitID", kitId)
		.query(
			"SELECT KitID, CmpnentID, CmpnentQty FROM Component WHERE KitID = @KitID",
		);
	return trimStrings(result.recordset as Component[]);
};

export const getAllComponents = async (): Promise<Component[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.query("SELECT KitID, CmpnentID, CmpnentQty FROM Component");
	return trimStrings(result.recordset as Component[]);
};

export const updateComponent = async (
	kitId: string,
	cmpnentId: string,
	updates: ComponentUpdate,
): Promise<Component> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("KitID", kitId)
		.input("CmpnentID", cmpnentId)
		.input("CmpnentQty", updates.CmpnentQty ?? null).query(`
      UPDATE Component
      SET CmpnentQty = @CmpnentQty
      OUTPUT INSERTED.KitID, INSERTED.CmpnentID, INSERTED.CmpnentQty
      WHERE KitID = @KitID AND CmpnentID = @CmpnentID
    `);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`Component ${kitId}/${cmpnentId} not found`);
	}
	return result.recordset[0] as Component;
};

export const deleteComponent = async (
	kitId: string,
	cmpnentId: string,
): Promise<void> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("KitID", kitId)
		.input("CmpnentID", cmpnentId)
		.query(
			"DELETE FROM Component OUTPUT DELETED.KitID WHERE KitID = @KitID AND CmpnentID = @CmpnentID",
		);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`Component ${kitId}/${cmpnentId} not found`);
	}
};

// ─── Joined query ────────────────────────────────────────────────────

export const getInventoryWithComponents = async (): Promise<
	InventoryWithComponent[]
> => {
	const pool = await getDb();
	const result = await pool.request().query(`
      SELECT
        i.InvtID, i.ClassID, i.ProdMgrID, i.Descr,
        c.KitID, c.CmpnentID, c.CmpnentQty
      FROM Inventory i
      LEFT JOIN Component c ON i.InvtID = c.KitID
      ORDER BY i.InvtID, c.CmpnentID
    `);
	return trimStrings(result.recordset as InventoryWithComponent[]);
};
