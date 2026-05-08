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
	PaginatedResponse,
} from "./price.schema";

// ─── Constants ─────────────────────────────────────────────────────────

/** Max rows per page */
const MAX_LIMIT = 10_000;

/** Default rows per page */
const DEFAULT_LIMIT = 500;

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
        d.DiscPrice, d.SlsUnit,
        i.Descr
      FROM SlsPrc h
      LEFT JOIN SlsPrcDet d ON h.SlsPrcID = d.SlsPrcID
      LEFT JOIN Inventory i ON h.InvtID = i.InvtID
      ORDER BY h.SlsPrcID
    `);
	return trimStrings(result.recordset as SlsPrcWithDet[]);
};

// ─── Exported constants ────────────────────────────────────────────────

export { MAX_LIMIT, DEFAULT_LIMIT };

// ─── Paginated queries ─────────────────────────────────────────────────

/**
 * Fetch paginated SlsPrc headers.
 *
 * @param page  Page number (1-based).
 * @param limit Rows per page (capped at MAX_LIMIT).
 */
export const getSlsPrcPaginated = async (
	page: number,
	limit: number,
): Promise<PaginatedResponse<SlsPrc>> => {
	const pool = await getDb();
	const offset = (page - 1) * limit;

	const [countResult, dataResult] = await Promise.all([
		pool.request().query("SELECT COUNT(*) AS _total FROM SlsPrc"),
		pool
			.request()
			.input("_offset", offset)
			.input("_limit", limit)
			.query(`
        SELECT * FROM (
          SELECT ROW_NUMBER() OVER (ORDER BY SlsPrcID) AS _row_num,
            SlsPrcID, InvtID, CatalogNbr
          FROM SlsPrc
        ) AS _paginated
        WHERE _row_num BETWEEN @_offset + 1 AND @_offset + @_limit
        ORDER BY _row_num
      `),
	]);

	const total = Number(countResult.recordset[0]?._total) || 0;
	const data = trimStrings(dataResult.recordset as SlsPrc[]);

	return {
		data,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit) || 1,
	};
};

/**
 * Fetch paginated SlsPrcDet details.
 *
 * @param page  Page number (1-based).
 * @param limit Rows per page (capped at MAX_LIMIT).
 */
export const getSlsPrcDetPaginated = async (
	page: number,
	limit: number,
): Promise<PaginatedResponse<SlsPrcDet>> => {
	const pool = await getDb();
	const offset = (page - 1) * limit;

	const [countResult, dataResult] = await Promise.all([
		pool.request().query("SELECT COUNT(*) AS _total FROM SlsPrcDet"),
		pool
			.request()
			.input("_offset", offset)
			.input("_limit", limit)
			.query(`
        SELECT * FROM (
          SELECT ROW_NUMBER() OVER (ORDER BY SlsPrcID) AS _row_num,
            SlsPrcID, DiscPrice, SlsUnit
          FROM SlsPrcDet
        ) AS _paginated
        WHERE _row_num BETWEEN @_offset + 1 AND @_offset + @_limit
        ORDER BY _row_num
      `),
	]);

	const total = Number(countResult.recordset[0]?._total) || 0;
	const data = trimStrings(dataResult.recordset as SlsPrcDet[]);

	return {
		data,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit) || 1,
	};
};

/**
 * Fetch paginated SlsPrc headers with their detail rows (joined).
 *
 * @param page  Page number (1-based).
 * @param limit Rows per page (capped at MAX_LIMIT).
 */
export const getSlsPrcWithDetsPaginated = async (
	page: number,
	limit: number,
	search?: string,
): Promise<PaginatedResponse<SlsPrcWithDet>> => {
	const pool = await getDb();
	const offset = (page - 1) * limit;

	const hasSearch = search != null && search.trim().length > 0;
	const searchClause = hasSearch
		? `WHERE h.SlsPrcID LIKE @search OR h.InvtID LIKE @search OR h.CatalogNbr LIKE @search OR i.Descr LIKE @search`
		: "";

	const countQuery = `SELECT COUNT(*) AS _total FROM SlsPrc h LEFT JOIN SlsPrcDet d ON h.SlsPrcID = d.SlsPrcID LEFT JOIN Inventory i ON h.InvtID = i.InvtID ${searchClause}`;

	const dataQuery = `
    SELECT * FROM (
      SELECT ROW_NUMBER() OVER (ORDER BY h.SlsPrcID) AS _row_num,
        h.SlsPrcID, h.InvtID, h.CatalogNbr,
        d.DiscPrice, d.SlsUnit,
        i.Descr
      FROM SlsPrc h
      LEFT JOIN SlsPrcDet d ON h.SlsPrcID = d.SlsPrcID
      LEFT JOIN Inventory i ON h.InvtID = i.InvtID
      ${searchClause}
    ) AS _paginated
    WHERE _row_num BETWEEN @_offset + 1 AND @_offset + @_limit
    ORDER BY _row_num
  `;

	const countRequest = pool.request();
	if (hasSearch) {
		countRequest.input("search", `%${search.trim()}%`);
	}
	const countResult = await countRequest.query(countQuery);

	const dataRequest = pool.request();
	if (hasSearch) {
		dataRequest.input("search", `%${search.trim()}%`);
	}
	dataRequest.input("_offset", offset);
	dataRequest.input("_limit", limit);
	const dataResult = await dataRequest.query(dataQuery);

	const total = Number(countResult.recordset[0]?._total) || 0;
	const data = trimStrings(dataResult.recordset as SlsPrcWithDet[]);

	return {
		data,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit) || 1,
	};
};
