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
	ItemSite,
	NewItemSite,
	ItemSiteUpdate,
	InventoryWithItemSite,
	InventoryWithComponentsAndItemSites,
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
		.input("Descr", inv.Descr)
		.input("StkUnit", inv.StkUnit).query(`
      INSERT INTO Inventory (InvtID, ClassID, ProdMgrID, Descr, StkUnit)
      OUTPUT INSERTED.InvtID, INSERTED.ClassID, INSERTED.ProdMgrID, INSERTED.Descr, INSERTED.StkUnit
      VALUES (@InvtID, @ClassID, @ProdMgrID, @Descr, @StkUnit)
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
			"SELECT InvtID, ClassID, ProdMgrID, Descr, StkUnit FROM Inventory WHERE InvtID = @InvtID",
		);
	return trimStrings(result.recordset[0] as Inventory | undefined);
};

export const getAllInventory = async (
	promoFilter: "all" | "promos" | "non_promos" = "all",
): Promise<InventoryWithPromo[]> => {
	const pool = await getDb();
	const baseSelect = `SELECT i.InvtID, i.ClassID, i.ProdMgrID, i.Descr, i.StkUnit`;

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
		.input("Descr", updates.Descr ?? null)
		.input("StkUnit", updates.StkUnit ?? null).query(`
      UPDATE Inventory
      SET ClassID = @ClassID, ProdMgrID = @ProdMgrID, Descr = @Descr, StkUnit = @StkUnit
      OUTPUT INSERTED.InvtID, INSERTED.ClassID, INSERTED.ProdMgrID, INSERTED.Descr, INSERTED.StkUnit
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

// ─── ItemSite CRUD ────────────────────────────────────────────────────

const ITEMSITE_COLS =
	"InvtID, SiteID, QtyCustOrd, QtyAlloc, QtyShipNotInv, QtyAllocIN, QtyOnPO, QtyAllocPORet, QtyAvail, QtyOnHand, TotCost, LUpd_DateTime";

const ITEMSITE_INSERT_COLS =
	"InvtID, SiteID, QtyCustOrd, QtyAlloc, QtyShipNotInv, QtyAllocIN, QtyOnPO, QtyAllocPORet, QtyAvail, QtyOnHand, TotCost";

export const createItemSite = async (
	itemSite: NewItemSite,
): Promise<ItemSite> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("InvtID", itemSite.InvtID)
		.input("SiteID", itemSite.SiteID)
		.input("QtyCustOrd", itemSite.QtyCustOrd)
		.input("QtyAlloc", itemSite.QtyAlloc)
		.input("QtyShipNotInv", itemSite.QtyShipNotInv)
		.input("QtyAllocIN", itemSite.QtyAllocIN)
		.input("QtyOnPO", itemSite.QtyOnPO)
		.input("QtyAllocPORet", itemSite.QtyAllocPORet)
		.input("QtyAvail", itemSite.QtyAvail)
		.input("QtyOnHand", itemSite.QtyOnHand)
		.input("TotCost", itemSite.TotCost).query(`
      INSERT INTO ItemSite (${ITEMSITE_INSERT_COLS})
      OUTPUT INSERTED.${ITEMSITE_COLS}
      VALUES (@InvtID, @SiteID, @QtyCustOrd, @QtyAlloc, @QtyShipNotInv, @QtyAllocIN, @QtyOnPO, @QtyAllocPORet, @QtyAvail, @QtyOnHand, @TotCost)
    `);

	const created = result.recordset[0];
	if (!created) throw new Error("Failed to create ItemSite");
	return created as ItemSite;
};

export const getAllItemSites = async (): Promise<ItemSite[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.query(`SELECT ${ITEMSITE_COLS} FROM ItemSite`);
	return trimStrings(result.recordset as ItemSite[]);
};

export const getItemSiteById = async (
	invtId: string,
	siteId: string,
): Promise<ItemSite | undefined> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("InvtID", invtId)
		.input("SiteID", siteId)
		.query(
			`SELECT ${ITEMSITE_COLS} FROM ItemSite WHERE InvtID = @InvtID AND SiteID = @SiteID`,
		);
	return trimStrings(result.recordset[0] as ItemSite | undefined);
};

export const getItemSitesByInvtId = async (
	invtId: string,
): Promise<ItemSite[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("InvtID", invtId)
		.query(
			`SELECT ${ITEMSITE_COLS} FROM ItemSite WHERE InvtID = @InvtID`,
		);
	return trimStrings(result.recordset as ItemSite[]);
};

export const updateItemSite = async (
	invtId: string,
	siteId: string,
	updates: ItemSiteUpdate,
): Promise<ItemSite> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("InvtID", invtId)
		.input("SiteID", siteId)
		.input("QtyCustOrd", updates.QtyCustOrd ?? null)
		.input("QtyAlloc", updates.QtyAlloc ?? null)
		.input("QtyShipNotInv", updates.QtyShipNotInv ?? null)
		.input("QtyAllocIN", updates.QtyAllocIN ?? null)
		.input("QtyOnPO", updates.QtyOnPO ?? null)
		.input("QtyAllocPORet", updates.QtyAllocPORet ?? null)
		.input("QtyAvail", updates.QtyAvail ?? null)
		.input("QtyOnHand", updates.QtyOnHand ?? null)
		.input("TotCost", updates.TotCost ?? null).query(`
      UPDATE ItemSite
      SET
        QtyCustOrd = @QtyCustOrd,
        QtyAlloc = @QtyAlloc,
        QtyShipNotInv = @QtyShipNotInv,
        QtyAllocIN = @QtyAllocIN,
        QtyOnPO = @QtyOnPO,
        QtyAllocPORet = @QtyAllocPORet,
        QtyAvail = @QtyAvail,
        QtyOnHand = @QtyOnHand,
        TotCost = @TotCost,
        LUpd_DateTime = GETDATE()
      OUTPUT INSERTED.${ITEMSITE_COLS}
      WHERE InvtID = @InvtID AND SiteID = @SiteID
    `);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`ItemSite ${invtId}/${siteId} not found`);
	}
	return trimStrings(result.recordset[0] as ItemSite);
};

export const deleteItemSite = async (
	invtId: string,
	siteId: string,
): Promise<void> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("InvtID", invtId)
		.input("SiteID", siteId)
		.query(
			"DELETE FROM ItemSite OUTPUT DELETED.InvtID WHERE InvtID = @InvtID AND SiteID = @SiteID",
		);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`ItemSite ${invtId}/${siteId} not found`);
	}
};

// ─── Joined query ────────────────────────────────────────────────────

export const getInventoryWithComponents = async (): Promise<
	InventoryWithComponent[]
> => {
	const pool = await getDb();
	const result = await pool.request().query(`
      SELECT
        i.InvtID, i.ClassID, i.ProdMgrID, i.Descr, i.StkUnit,
        c.KitID, c.CmpnentID, c.CmpnentQty
      FROM Inventory i
      LEFT JOIN Component c ON i.InvtID = c.KitID
      ORDER BY i.InvtID, c.CmpnentID
    `);
	return trimStrings(result.recordset as InventoryWithComponent[]);
};

export const getInventoryWithItemSites = async (): Promise<
	InventoryWithItemSite[]
> => {
	const pool = await getDb();
	const result = await pool.request().query(`
      SELECT
        i.InvtID, i.ClassID, i.ProdMgrID, i.Descr, i.StkUnit,
        s.SiteID, s.QtyCustOrd, s.QtyAlloc, s.QtyShipNotInv, s.QtyAllocIN,
        s.QtyOnPO, s.QtyAllocPORet, s.QtyAvail, s.QtyOnHand, s.TotCost, s.LUpd_DateTime
      FROM Inventory i
      LEFT JOIN ItemSite s ON i.InvtID = s.InvtID
      ORDER BY i.InvtID, s.SiteID
    `);
	return trimStrings(result.recordset as InventoryWithItemSite[]);
};

export const getInventoryWithComponentsAndItemSites = async (
	sites?: string,
): Promise<InventoryWithComponentsAndItemSites[]> => {
	const pool = await getDb();

	const request = pool.request();
	let siteFilter = "";

	if (sites) {
		const siteList = sites.split(",").map((s) => s.trim()).filter(Boolean);
		if (siteList.length > 0) {
			const conditions = siteList.map((site, i) => {
				request.input(`SiteID${i}`, site);
				return `@SiteID${i}`;
			});
			siteFilter = `AND s.SiteID IN (${conditions.join(", ")})`;
		}
	}

	const result = await request.query(`
      SELECT
        i.InvtID, i.ClassID, i.ProdMgrID, i.Descr, i.StkUnit,
        c.KitID, c.CmpnentID, c.CmpnentQty,
        s.SiteID, s.QtyCustOrd, s.QtyAlloc, s.QtyShipNotInv, s.QtyAllocIN,
        s.QtyOnPO, s.QtyAllocPORet, s.QtyAvail, s.QtyOnHand, s.TotCost, s.LUpd_DateTime
      FROM Inventory i
      LEFT JOIN Component c ON i.InvtID = c.KitID
      LEFT JOIN ItemSite s ON i.InvtID = s.InvtID
      WHERE s.SiteID IS NOT NULL ${siteFilter}
      ORDER BY i.InvtID, c.CmpnentID, s.SiteID
    `);
	return trimStrings(result.recordset as InventoryWithComponentsAndItemSites[]);
};
