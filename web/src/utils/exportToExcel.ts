import * as XLSX from "xlsx";
import type { GridColDef } from "@mui/x-data-grid";

/**
 * Export DataGrid rows/columns to an Excel .xlsx file.
 *
 * Resolves valueGetter for dynamic columns (e.g. monthly demand).
 * Uses raw numeric values (not formatted strings) so Excel can do math.
 *
 * @param rows    Row data from the DataGrid.
 * @param columns Column definitions (field, headerName, valueGetter).
 * @param filename  Output filename (default: "export.xlsx").
 */
export function exportDataGridToExcel(
	rows: Record<string, unknown>[],
	columns: GridColDef[],
	filename = "export.xlsx",
): void {
	if (rows.length === 0 || columns.length === 0) return;

	// Build header row from column headerName (fallback to field)
	const headers = columns.map((col) => col.headerName ?? col.field);

	// Build data rows: for each column, resolve value (via valueGetter or direct field access)
	const data = rows.map((row) => {
		return columns.map((col) => {
			if (col.valueGetter) {
				// valueGetter signature: (value, row, column, apiRef)
				// We only need `row` — cast to match MUI internal types
				return (col.valueGetter as (...args: unknown[]) => unknown)(
					null,
					row,
					col,
					null,
				);
			}
			return row[col.field];
		});
	});

	// Create worksheet from array of arrays
	const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

	// Auto-size column widths (capped at 50 chars)
	const colWidths = headers.map((header, i) => {
		const maxLen = Math.max(
			header.length,
			...data.map((row) => String(row[i] ?? "").length),
		);
		return { wch: Math.min(maxLen + 3, 50) };
	});
	ws["!cols"] = colWidths;

	// Build workbook and trigger download
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, "Data");
	XLSX.writeFile(wb, filename);
}
