import { getDb } from "../../config/db";
import { NotFoundError } from "../../middlewares/error";
import { trimStrings } from "../../utils/trimStrings";
import type {
	SlsPrc,
	NewSlsPrc,
	SlsPrcUpdate,
	SlsPrcDet,
	NewSlsPrcDet,
	SlsPrcWithDet,
} from "./price.schema";

// ─── SlsPrc CRUD ─────────────────────────────────────────────────────

export const createSlsPrc = async (prc: NewSlsPrc): Promise<SlsPrc> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("SlsPrcID", prc.SlsPrcID)
		.input("InvtID", prc.InvtID)
		.input("CatalogNbr", prc.CatalogNbr).query(`
      INSERT INTO SlsPrc (SlsPrcID, InvtID, CatalogNbr)
      OUTPUT INSERTED.SlsPrcID, INSERTED.InvtID, INSERTED.CatalogNbr
      VALUES (@SlsPrcID, @InvtID, @CatalogNbr)
    `);

	const created = result.recordset[0];
	if (!created) throw new Error("Failed to create SlsPrc");
	return trimStrings(created as SlsPrc);
};

export const getSlsPrcById = async (
	slsPrcId: string,
): Promise<SlsPrc | undefined> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("SlsPrcID", slsPrcId)
		.query(
			"SELECT SlsPrcID, InvtID, CatalogNbr FROM SlsPrc WHERE SlsPrcID = @SlsPrcID",
		);
	return trimStrings(result.recordset[0] as SlsPrc | undefined);
};

export const getAllSlsPrc = async (): Promise<SlsPrc[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.query("SELECT SlsPrcID, InvtID, CatalogNbr FROM SlsPrc");
	return trimStrings(result.recordset as SlsPrc[]);
};

export const updateSlsPrc = async (
	slsPrcId: string,
	updates: SlsPrcUpdate,
): Promise<SlsPrc> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("SlsPrcID", slsPrcId)
		.input("InvtID", updates.InvtID ?? null)
		.input("CatalogNbr", updates.CatalogNbr ?? null).query(`
      UPDATE SlsPrc
      SET InvtID = @InvtID, CatalogNbr = @CatalogNbr
      OUTPUT INSERTED.SlsPrcID, INSERTED.InvtID, INSERTED.CatalogNbr
      WHERE SlsPrcID = @SlsPrcID
    `);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`SlsPrc ${slsPrcId} not found`);
	}
	return trimStrings(result.recordset[0] as SlsPrc);
};

export const deleteSlsPrc = async (slsPrcId: string): Promise<void> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("SlsPrcID", slsPrcId)
		.query(
			"DELETE FROM SlsPrc OUTPUT DELETED.SlsPrcID WHERE SlsPrcID = @SlsPrcID",
		);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`SlsPrc ${slsPrcId} not found`);
	}
};

// ─── SlsPrcDet CRUD ──────────────────────────────────────────────────

export const createSlsPrcDet = async (
	det: NewSlsPrcDet,
): Promise<SlsPrcDet> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("SlsPrcID", det.SlsPrcID)
		.input("DiscPrice", det.DiscPrice)
		.input("SlsUnit", det.SlsUnit).query(`
      INSERT INTO SlsPrcDet (SlsPrcID, DiscPrice, SlsUnit)
      OUTPUT INSERTED.SlsPrcID, INSERTED.DiscPrice, INSERTED.SlsUnit
      VALUES (@SlsPrcID, @DiscPrice, @SlsUnit)
    `);

	const created = result.recordset[0];
	if (!created) throw new Error("Failed to create SlsPrcDet");
	return created as SlsPrcDet;
};

export const getSlsPrcDetByHeaderId = async (
	slsPrcId: string,
): Promise<SlsPrcDet[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.input("SlsPrcID", slsPrcId)
		.query(
			"SELECT SlsPrcID, DiscPrice, SlsUnit FROM SlsPrcDet WHERE SlsPrcID = @SlsPrcID",
		);
	return trimStrings(result.recordset as SlsPrcDet[]);
};

export const getAllSlsPrcDet = async (): Promise<SlsPrcDet[]> => {
	const pool = await getDb();
	const result = await pool
		.request()
		.query("SELECT SlsPrcID, DiscPrice, SlsUnit FROM SlsPrcDet");
	return trimStrings(result.recordset as SlsPrcDet[]);
};

// ─── Joined query ────────────────────────────────────────────────────

export const getSlsPrcWithDets = async (): Promise<SlsPrcWithDet[]> => {
	const pool = await getDb();
	const result = await pool.request().query(`
      SELECT
        h.SlsPrcID, h.InvtID, h.CatalogNbr,
        d.DiscPrice, d.SlsUnit
      FROM SlsPrc h
      LEFT JOIN SlsPrcDet d ON h.SlsPrcID = d.SlsPrcID
      ORDER BY h.SlsPrcID
    `);
	return trimStrings(result.recordset as SlsPrcWithDet[]);
};
