import { withDb } from "../../config/db";
import { trimStrings } from "../../utils/trimStrings";
import { BadRequestError, NotFoundError } from "../../middlewares/error";
import { existsSync, mkdirSync } from "fs";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import type { PurchaseOrder, NewPurchaseOrder } from "./purchase-order.schema";

// ─── Column list (shared to keep SELECT statements DRY) ────────────────

const PO_COLUMNS = `
  id, ref_num, principal_id, site_id, demand_mode, frequency,
   sales_from, sales_to, csv_filename, created_by,
  last_update_at, last_update_by, status,
  status_from, status_by, created_at
`;

/** Same columns with INSERTED. prefix for INSERT/UPDATE OUTPUT clauses. */
const PO_COLUMNS_INSERTED = `
  INSERTED.id, INSERTED.ref_num, INSERTED.principal_id, INSERTED.site_id,
  INSERTED.demand_mode, INSERTED.frequency,
  INSERTED.sales_from, INSERTED.sales_to, INSERTED.csv_filename,
  INSERTED.created_by, INSERTED.last_update_at, INSERTED.last_update_by,
  INSERTED.status, INSERTED.status_from, INSERTED.status_by,
  INSERTED.created_at
`;

// ─── Constants ────────────────────────────────────────────────────────

const PO_FILES_DIR =
	process.env.PO_STORAGE_PATH ||
	join(process.cwd(), "data", "po");

// ─── CSV helpers ──────────────────────────────────────────────────────

function toCsvValue(value: unknown): string {
	if (value === null || value === undefined) return "";
	const str = String(value);
	// Prevent CSV formula injection — prefix with single-quote when value
	// starts with a formula-triggering character (=, +, -, @, tab).
	const sanitised = /^[=+\-@\t]/.test(str) ? `"'${str}"` : str;
	if (sanitised.includes(",") || sanitised.includes('"') || sanitised.includes("\n") || sanitised.includes("\r")) {
		return `"${sanitised.replace(/"/g, '""')}"`;
	}
	return sanitised;
}

function parseCsvLine(line: string): string[] {
	const values: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"' && line[i + 1] === '"') {
				current += '"';
				i++;
			} else if (ch === '"') {
				inQuotes = false;
			} else {
				current += ch;
			}
		} else {
			if (ch === '"') {
				inQuotes = true;
			} else if (ch === ",") {
				values.push(current);
				current = "";
			} else {
				current += ch;
			}
		}
	}
	values.push(current);
	return values;
}

/**
 * Serialize an array of row objects to CSV string.
 * Uses the first row's keys as the header.
 */
function rowsToCsv(rows: Record<string, unknown>[]): string {
	if (rows.length === 0) return "";
	const first = rows[0];
	if (!first) return "";
	const headers = Object.keys(first);
	const lines = [headers.map(toCsvValue).join(",")];
	for (const row of rows) {
		lines.push(headers.map((h) => toCsvValue(row[h])).join(","));
	}
	return lines.join("\n");
}

/**
 * Parse a CSV string into an array of row objects.
 * First line is treated as the header.
 */
function csvToRows(csv: string): { headers: string[]; rows: Record<string, string>[] } {
	const lines = csv.split("\n").filter((l) => l.trim().length > 0);
	if (lines.length === 0) return { headers: [], rows: [] };

	const headerLine = lines[0];
	if (!headerLine) return { headers: [], rows: [] };
	const headers = parseCsvLine(headerLine);
	const rows: Record<string, string>[] = [];
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const values = parseCsvLine(line);
		if (values.length === 0) continue;
		const row: Record<string, string> = {};
		headers.forEach((h, idx) => {
			row[h] = values[idx] ?? "";
		});
		rows.push(row);
	}
	return { headers, rows };
}

// ─── File helpers ─────────────────────────────────────────────────────

function ensurePoDir(): void {
	if (!existsSync(PO_FILES_DIR)) {
		mkdirSync(PO_FILES_DIR, { recursive: true });
	}
}

// ─── CRUD ─────────────────────────────────────────────────────────────

export async function getAllPurchaseOrders(): Promise<PurchaseOrder[]> {
	const result = await withDb((pool) =>
		pool
			.request()
			.query(
				`SELECT ${PO_COLUMNS} FROM SMR_PurchaseOrders ORDER BY created_at DESC`,
			),
	);
	return trimStrings(result.recordset as PurchaseOrder[]);
}

export async function getPurchaseOrderById(
	id: number,
): Promise<{ meta: PurchaseOrder; csvData: { headers: string[]; rows: Record<string, string>[] } }> {
	const result = await withDb((pool) =>
		pool
			.request()
			.input("id", id)
			.query(
				`SELECT ${PO_COLUMNS} FROM SMR_PurchaseOrders WHERE id = @id`,
			),
	);

	const meta = trimStrings(result.recordset[0] as PurchaseOrder | undefined);
	if (!meta) {
		throw new NotFoundError(`PurchaseOrder ${id} not found`);
	}

	// Parse CSV file if it exists
	if (meta.csv_filename) {
		const filePath = join(PO_FILES_DIR, meta.csv_filename);
		try {
			const csvContent = await readFile(filePath, "utf-8");
			const csvData = csvToRows(csvContent);
			return { meta, csvData };
		} catch {
			return { meta, csvData: { headers: [], rows: [] } };
		}
	}

	return { meta, csvData: { headers: [], rows: [] } };
}

export async function createPurchaseOrder(
	body: NewPurchaseOrder,
	rows: Record<string, unknown>[],
): Promise<PurchaseOrder> {
	// Check for duplicate ref_num before attempting insert
	const existing = await withDb((pool) =>
		pool
			.request()
			.input("ref_num", body.ref_num)
			.query("SELECT COUNT(*) AS cnt FROM SMR_PurchaseOrders WHERE ref_num = @ref_num"),
	);
	const count: number = existing.recordset[0]?.cnt ?? 0;
	if (count > 0) {
		throw new BadRequestError(
			`Reference number "${body.ref_num}" already exists. Please use a unique reference number.`,
		);
	}

	return withDb(async (pool) => {
		// 1. Insert the record (csv_filename will be set after we know the ID)
		const insertResult = await pool
			.request()
			.input("ref_num", body.ref_num)
			.input("principal_id", body.principal_id)
			.input("site_id", body.site_id)
			.input("demand_mode", body.demand_mode)
			.input("frequency", body.frequency)
			.input("sales_from", body.sales_from)
			.input("sales_to", body.sales_to)
			.input("created_by", body.created_by).query(`
        INSERT INTO SMR_PurchaseOrders (ref_num, principal_id, site_id, demand_mode, frequency, sales_from, sales_to, created_by)
        OUTPUT ${PO_COLUMNS_INSERTED}
        VALUES (@ref_num, @principal_id, @site_id, @demand_mode, @frequency, @sales_from, @sales_to, @created_by)
      `);

		const created = trimStrings(insertResult.recordset[0] as PurchaseOrder);
		if (!created) throw new Error("Failed to create purchase order");

		// 2. Write CSV file
		const csvFilename = `po_${created.id}.csv`;
		const csvContent = rowsToCsv(rows);
		ensurePoDir();
		await writeFile(join(PO_FILES_DIR, csvFilename), csvContent, "utf-8");

		// 3. Update record with csv_filename
		const updateResult = await pool
			.request()
			.input("id", created.id)
			.input("csv_filename", csvFilename)
			.query(`
        UPDATE SMR_PurchaseOrders
        SET csv_filename = @csv_filename
        OUTPUT ${PO_COLUMNS_INSERTED}
        WHERE id = @id
      `);

		return trimStrings(updateResult.recordset[0] as PurchaseOrder);
	});
}

/**
 * Update a purchase order's CSV data and record who updated it.
 * Rewrites the CSV file on disk and sets last_update_at / last_update_by.
 * Validates that the PO exists before writing.
 */
export async function updatePurchaseOrderCsv(
	id: number,
	rows: Record<string, unknown>[],
	updatedBy: string,
): Promise<PurchaseOrder> {
	// Verify PO exists and get current filename
	const existing = await getPurchaseOrderById(id);
	const csvFilename = existing.meta.csv_filename ?? `po_${id}.csv`;

	// Rewrite CSV file
	const csvContent = rowsToCsv(rows);
	ensurePoDir();
	await writeFile(join(PO_FILES_DIR, csvFilename), csvContent, "utf-8");

	// Update last_update_at / last_update_by
	return withDb(async (pool) => {
		const result = await pool
			.request()
			.input("id", id)
			.input("csv_filename", csvFilename)
			.input("last_update_by", updatedBy).query(`
        UPDATE SMR_PurchaseOrders
        SET csv_filename = @csv_filename,
            last_update_at = GETDATE(),
            last_update_by = @last_update_by
        OUTPUT ${PO_COLUMNS_INSERTED}
        WHERE id = @id
      `);

		const updated = trimStrings(result.recordset[0] as PurchaseOrder | undefined);
		if (!updated) throw new NotFoundError(`PurchaseOrder ${id} not found`);
		return updated;
	});
}

/**
 * Update a purchase order's status (Pending / Printed / Approved / Encoded / Cancelled).
 * Status changes do NOT affect last_update_at / last_update_by — they only
 * update the status, status_from, and status_by columns.
 */
export async function updatePoStatus(
	id: number,
	status: string,
	updatedBy: string,
): Promise<PurchaseOrder> {
	return withDb(async (pool) => {
		const result = await pool
			.request()
			.input("id", id)
			.input("status", status)
			.input("status_by", updatedBy).query(`
        UPDATE SMR_PurchaseOrders
        SET status = @status,
            status_from = GETDATE(),
            status_by = @status_by
        OUTPUT ${PO_COLUMNS_INSERTED}
        WHERE id = @id
      `);

		const updated = trimStrings(result.recordset[0] as PurchaseOrder | undefined);
		if (!updated) throw new NotFoundError(`PurchaseOrder ${id} not found`);
		return updated;
	});
}

export async function deletePurchaseOrder(id: number): Promise<void> {
	// First, get the csv_filename to delete the file
	const result = await withDb((pool) =>
		pool
			.request()
			.input("id", id)
			.query(
				"SELECT csv_filename FROM SMR_PurchaseOrders WHERE id = @id",
			),
	);

	const row = result.recordset[0] as { csv_filename: string | null } | undefined;
	if (!row) {
		throw new NotFoundError(`PurchaseOrder ${id} not found`);
	}

	// Delete from database
	await withDb((pool) =>
		pool
			.request()
			.input("id", id)
			.query("DELETE FROM SMR_PurchaseOrders OUTPUT DELETED.id WHERE id = @id"),
	);

	// Delete CSV file if exists
	if (row.csv_filename) {
		const filePath = join(PO_FILES_DIR, row.csv_filename);
		try {
			await unlink(filePath);
		} catch {
			// File might not exist — that's fine
		}
	}
}
