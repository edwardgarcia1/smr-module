import * as XLSX from "xlsx-js-style";
import type {
	GridColDef,
	GridColumnGroupingModel,
} from "@mui/x-data-grid";

export interface ExcelExportOptions {
	/** First row — bold centered title spanning all columns */
	title?: string;
	/** Second row — optional subtitle (e.g. principal name) */
	subtitle?: string;
	/**
	 * Column grouping model — produces a merged header row between the
	 * spacer and the individual column headers.
	 */
	columnGroupingModel?: GridColumnGroupingModel;
	/**
	 * Called for each data row. Return an RGB fill string (without `#` or `FF`)
	 * to highlight the row, or `null` for no fill.
	 * @example "ffcdd2" for light red
	 */
	getRowFill?: (row: Record<string, unknown>) => string | null;
}

/**
 * Export DataGrid rows/columns to a styled Excel .xlsx file.
 *
 * Supports:
 * - Title / subtitle rows (merged across all columns)
 * - Column group headers (merged per group, grey background)
 * - Row highlighting via `getRowFill` callback
 * - Number format detection for numeric columns
 * - Auto-sized column widths
 */
export function exportDataGridToExcel(
	rows: Record<string, unknown>[],
	columns: GridColDef[],
	options?: ExcelExportOptions,
	filename = "export.xlsx",
): void {
	if (rows.length === 0 || columns.length === 0) return;

	const { title, subtitle, columnGroupingModel, getRowFill } = options ?? {};
	const numCols = columns.length;
	const hasGroups =
		columnGroupingModel != null && columnGroupingModel.length > 0;

	// ── Resolve cell values (respect valueGetter) ────────────────────
	const headers = columns.map((col) => col.headerName ?? col.field);

	const dataValues: unknown[][] = rows.map((row) =>
		columns.map((col) => {
			if (col.valueGetter) {
				return (col.valueGetter as (...args: unknown[]) => unknown)(
					null,
					row,
					col,
					null,
				);
			}
			return row[col.field];
		}),
	);

	// ── Layout ──────────────────────────────────────────────────────
	// Row indices:
	//   0            — title (if set)
	//   1            — subtitle (if set)
	//   2            — empty spacer
	//   3            — column group header row (if hasGroups)
	//   4            — individual column headers
	//   5 (or 3/4)   — first data row
	//
	const wsData: unknown[][] = [];
	const merges: XLSX.Range[] = [];

	let titleRowIdx = -1;
	let subtitleRowIdx = -1;
	let groupHeaderRowIdx = -1;
	let headerRowIdx = -1;

	if (title) {
		titleRowIdx = wsData.length;
		const row: unknown[] = new Array(numCols).fill(null);
		row[0] = title;
		wsData.push(row);
	}
	if (subtitle) {
		subtitleRowIdx = wsData.length;
		const row: unknown[] = new Array(numCols).fill(null);
		row[0] = subtitle;
		wsData.push(row);
	}
	// Empty spacer
	wsData.push(new Array(numCols).fill(null));

		if (hasGroups) {
		groupHeaderRowIdx = wsData.length;
		const row: unknown[] = new Array(numCols).fill(null);
		for (const group of columnGroupingModel!) {
			const indices: number[] = [];
			for (const child of group.children) {
				// Only leaf nodes have a field; group nodes are skipped.
				if (!("children" in child)) {
					const idx = columns.findIndex(
						(c) => c.field === (child as { field: string }).field,
					);
					if (idx >= 0) indices.push(idx);
				}
			}
			if (indices.length > 0) {
				row[Math.min(...indices)] = group.groupId;
			}
		}
		wsData.push(row);
	}

	headerRowIdx = wsData.length;
	wsData.push(headers);

	const dataStartRow = wsData.length;
	for (const row of dataValues) {
		wsData.push(row);
	}

	// ── Build worksheet ─────────────────────────────────────────────
	const ws = XLSX.utils.aoa_to_sheet(wsData);

	// Merges — title, subtitle, column groups
	if (titleRowIdx >= 0) {
		merges.push({
			s: { r: titleRowIdx, c: 0 },
			e: { r: titleRowIdx, c: numCols - 1 },
		});
	}
	if (subtitleRowIdx >= 0) {
		merges.push({
			s: { r: subtitleRowIdx, c: 0 },
			e: { r: subtitleRowIdx, c: numCols - 1 },
		});
	}
	if (hasGroups) {
		for (const group of columnGroupingModel!) {
			const indices: number[] = [];
			for (const child of group.children) {
				// Only leaf nodes have a field; group nodes are skipped.
				if (!("children" in child)) {
					const idx = columns.findIndex(
						(c) => c.field === (child as { field: string }).field,
					);
					if (idx >= 0) indices.push(idx);
				}
			}
			if (indices.length > 1) {
				merges.push({
					s: { r: groupHeaderRowIdx, c: Math.min(...indices) },
					e: { r: groupHeaderRowIdx, c: Math.max(...indices) },
				});
			}
		}
	}
	ws["!merges"] = merges;

	// ── Apply cell styles ───────────────────────────────────────────
	// Helper: create a cell object if it doesn't exist at a given position.
	// AOA only creates cells for non-null values, so merged "empty" cells
	// in the title / subtitle rows may be missing the anchor cell's style.
	function ensureCell(R: number, C: number): XLSX.CellObject | undefined {
		const addr = XLSX.utils.encode_cell({ r: R, c: C });
		let cell = ws[addr] as XLSX.CellObject | undefined;
		if (!cell) {
			cell = { t: "z", v: undefined };
			ws[addr] = cell;
		}
		return cell;
	}

	// 1. Title row
	if (titleRowIdx >= 0) {
		const cell = ensureCell(titleRowIdx, 0);
		if (cell) {
			cell.s = {
				font: { bold: true, sz: 14, name: "Calibri" },
				alignment: { horizontal: "center", vertical: "center" },
			};
		}
	}

	// 2. Subtitle row
	if (subtitleRowIdx >= 0) {
		const cell = ensureCell(subtitleRowIdx, 0);
		if (cell) {
			cell.s = {
				font: { italic: true, sz: 11, name: "Calibri", color: { rgb: "555555" } },
				alignment: { horizontal: "center", vertical: "center" },
			};
		}
	}

	// 3. Column group header row
	if (groupHeaderRowIdx >= 0) {
		for (let C = 0; C < numCols; C++) {
			const cell = ensureCell(groupHeaderRowIdx, C);
			if (cell) {
				cell.s = {
					font: { bold: true, sz: 10, name: "Calibri" },
					fill: { fgColor: { rgb: "FFD9E2F3" }, patternType: "solid" },
					alignment: { horizontal: "center", vertical: "center", wrapText: true },
					border: {
						top: { style: "thin", color: { rgb: "FFB0B0B0" } },
						bottom: { style: "thin", color: { rgb: "FFB0B0B0" } },
						left: { style: "thin", color: { rgb: "FFB0B0B0" } },
						right: { style: "thin", color: { rgb: "FFB0B0B0" } },
					},
				};
			}
		}
	}

	// 4. Individual header row
	for (let C = 0; C < numCols; C++) {
		const cell = ensureCell(headerRowIdx, C);
		if (cell) {
			cell.s = {
				font: { bold: true, sz: 10, name: "Calibri" },
				fill: { fgColor: { rgb: "FFF2F2F2" }, patternType: "solid" },
				alignment: { horizontal: "center", vertical: "center", wrapText: true },
				border: {
					top: { style: "thin", color: { rgb: "FFB0B0B0" } },
					bottom: { style: "thin", color: { rgb: "FFB0B0B0" } },
					left: { style: "thin", color: { rgb: "FFB0B0B0" } },
					right: { style: "thin", color: { rgb: "FFB0B0B0" } },
				},
			};
		}
	}

	// 5. Data rows
	for (let R = dataStartRow; R < wsData.length; R++) {
		const row = rows[R - dataStartRow];
		const fillColor = getRowFill?.(row) ?? null;

		for (let C = 0; C < numCols; C++) {
			const cell = ensureCell(R, C);
			if (!cell) continue;

			const isNumber =
				typeof cell.v === "number" ||
				(columns[C].type === "number" && cell.v != null);

			const style: XLSX.CellStyle = {
				font: { sz: 10, name: "Calibri" },
				alignment: {
					horizontal: isNumber ? "right" : "left",
					vertical: "center",
				},
				border: {
					bottom: { style: "thin", color: { rgb: "FFE0E0E0" } },
				},
			};

			if (fillColor) {
				style.fill = { fgColor: { rgb: `FF${fillColor}` }, patternType: "solid" };
			}

			cell.s = style;
		}
	}

	// ── Auto-size columns ───────────────────────────────────────────
	const colWidths: XLSX.ColInfo[] = headers.map((header, ci) => {
		let maxLen = String(header).length;
		for (const row of dataValues) {
			const val = row[ci];
			if (val != null) {
				const len = String(val).length;
				if (len > maxLen) maxLen = len;
			}
		}
		return { wch: Math.min(maxLen + 3, 55) };
	});
	ws["!cols"] = colWidths;

	// ── Build workbook & download ───────────────────────────────────
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, "Data");
	XLSX.writeFile(wb, filename);
}
