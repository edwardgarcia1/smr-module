import { withDb } from "../../config/db";
import { trimStrings } from "../../utils/trimStrings";
import { NotFoundError } from "../../middlewares/error";
import { existsSync, mkdirSync } from "fs";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import type { PurchaseOrder, NewPurchaseOrder } from "./purchase-order.schema";

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
				"SELECT id, ref_num, principal_id, site_id, demand_mode, frequency, sales_from, sales_to, csv_filename, created_at FROM SMR_PurchaseOrders ORDER BY created_at DESC",
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
				"SELECT id, ref_num, principal_id, site_id, demand_mode, frequency, sales_from, sales_to, csv_filename, created_at FROM SMR_PurchaseOrders WHERE id = @id",
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
			.input("sales_to", body.sales_to).query(`
        INSERT INTO SMR_PurchaseOrders (ref_num, principal_id, site_id, demand_mode, frequency, sales_from, sales_to)
        OUTPUT INSERTED.id, INSERTED.ref_num, INSERTED.principal_id, INSERTED.site_id, INSERTED.demand_mode, INSERTED.frequency, INSERTED.sales_from, INSERTED.sales_to, INSERTED.csv_filename, INSERTED.created_at
        VALUES (@ref_num, @principal_id, @site_id, @demand_mode, @frequency, @sales_from, @sales_to)
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
        OUTPUT INSERTED.id, INSERTED.ref_num, INSERTED.principal_id, INSERTED.site_id, INSERTED.demand_mode, INSERTED.frequency, INSERTED.sales_from, INSERTED.sales_to, INSERTED.csv_filename, INSERTED.created_at
        WHERE id = @id
      `);

		return trimStrings(updateResult.recordset[0] as PurchaseOrder);
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
