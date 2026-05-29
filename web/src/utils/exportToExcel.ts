import { Workbook } from "@cj-tech-master/excelts";
import type {
	GridColDef,
	GridColumnGroupingModel,
} from "@mui/x-data-grid";
import { downloadBlob } from "./download";

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
	 * Called for each data row. Return a 6-char hex fill string (without `#`)
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
export async function exportDataGridToExcel(
	rows: Record<string, unknown>[],
	columns: GridColDef[],
	options?: ExcelExportOptions,
	filename = "export.xlsx",
): Promise<void> {
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
	// Row numbers (1-based):
	//   1             — title (if set)
	//   2             — subtitle (if set)
	//   3             — empty spacer
	//   4             — column group header row (if hasGroups)
	//   5             — individual column headers
	//   6 (or 4/5)    — first data row
	//
	const workbook = new Workbook();
	const sheet = workbook.addWorksheet("Data");

	let rowNum = 1;
	let titleRow = -1;
	let subtitleRow = -1;
	let groupHeaderRow = -1;
	let headerRow = -1;

	if (title) {
		titleRow = rowNum;
		sheet.addRow([title]);
		rowNum++;
	}
	if (subtitle) {
		subtitleRow = rowNum;
		sheet.addRow([subtitle]);
		rowNum++;
	}
	// Empty spacer
	sheet.addRow(new Array(numCols).fill(null));
	rowNum++;

	if (hasGroups) {
		groupHeaderRow = rowNum;
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
		sheet.addRow(row);
		rowNum++;
	}

	headerRow = rowNum;
	sheet.addRow(headers);
	rowNum++;

	const dataStartRow = rowNum;
	for (const row of dataValues) {
		sheet.addRow(row);
		rowNum++;
	}

	// ── Merges ──────────────────────────────────────────────────────
	if (titleRow >= 1) {
		sheet.mergeCells({
			top: titleRow,
			left: 1,
			bottom: titleRow,
			right: numCols,
		});
	}
	if (subtitleRow >= 1) {
		sheet.mergeCells({
			top: subtitleRow,
			left: 1,
			bottom: subtitleRow,
			right: numCols,
		});
	}
	if (hasGroups && groupHeaderRow >= 1) {
		for (const group of columnGroupingModel!) {
			const indices: number[] = [];
			for (const child of group.children) {
				if (!("children" in child)) {
					const idx = columns.findIndex(
						(c) => c.field === (child as { field: string }).field,
					);
					if (idx >= 0) indices.push(idx);
				}
			}
			if (indices.length > 1) {
				sheet.mergeCells({
					top: groupHeaderRow,
					left: Math.min(...indices) + 1,
					bottom: groupHeaderRow,
					right: Math.max(...indices) + 1,
				});
			}
		}
	}

	// ── Apply cell styles ───────────────────────────────────────────
	// 1. Title row
	if (titleRow >= 1) {
		const c = sheet.getCell(titleRow, 1);
		c.font = { bold: true, size: 14, name: "Calibri" };
		c.alignment = { horizontal: "center", vertical: "middle" };
	}

	// 2. Subtitle row
	if (subtitleRow >= 1) {
		const c = sheet.getCell(subtitleRow, 1);
		c.font = {
			italic: true,
			size: 11,
			name: "Calibri",
			color: { argb: "FF555555" },
		};
		c.alignment = { horizontal: "center", vertical: "middle" };
	}

	// 3. Column group header row
	if (groupHeaderRow >= 1) {
		for (let C = 1; C <= numCols; C++) {
			const c = sheet.getCell(groupHeaderRow, C);
			c.font = { bold: true, size: 10, name: "Calibri" };
			c.fill = {
				type: "pattern",
				pattern: "solid",
				fgColor: { argb: "FFD9E2F3" },
			};
			c.alignment = {
				horizontal: "center",
				vertical: "middle",
				wrapText: true,
			};
			c.border = {
				top: { style: "thin", color: { argb: "FFB0B0B0" } },
				bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
				left: { style: "thin", color: { argb: "FFB0B0B0" } },
				right: { style: "thin", color: { argb: "FFB0B0B0" } },
			};
		}
	}

	// 4. Individual header row
	for (let C = 1; C <= numCols; C++) {
		const c = sheet.getCell(headerRow, C);
		c.font = { bold: true, size: 10, name: "Calibri" };
		c.fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFF2F2F2" },
		};
		c.alignment = {
			horizontal: "center",
			vertical: "middle",
			wrapText: true,
		};
		c.border = {
			top: { style: "thin", color: { argb: "FFB0B0B0" } },
			bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
			left: { style: "thin", color: { argb: "FFB0B0B0" } },
			right: { style: "thin", color: { argb: "FFB0B0B0" } },
		};
	}

	// 5. Data rows
	for (let R = dataStartRow; R < rowNum; R++) {
		const dataRow = rows[R - dataStartRow];
		const fillColor = getRowFill?.(dataRow) ?? null;

		for (let C = 1; C <= numCols; C++) {
			const c = sheet.getCell(R, C);
			const isNumber =
				typeof c.value === "number" ||
				(columns[C - 1]?.type === "number" && c.value != null);

			c.font = { size: 10, name: "Calibri" };
			c.alignment = {
				horizontal: isNumber ? "right" : "left",
				vertical: "middle",
			};
			c.border = {
				bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
			};

			if (fillColor) {
				c.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: `FF${fillColor.toUpperCase()}` },
				};
			}
		}
	}

	// ── Auto-size columns ───────────────────────────────────────────
	for (let ci = 0; ci < numCols; ci++) {
		let maxLen = String(headers[ci]).length;
		for (const row of dataValues) {
			const val = row[ci];
			if (val != null) {
				const len = String(val).length;
				if (len > maxLen) maxLen = len;
			}
		}
		sheet.getColumn(ci + 1).width = Math.min(maxLen + 3, 55);
	}

	// ── Build workbook & download ───────────────────────────────────
	const buffer = await workbook.xlsx.writeBuffer();
	downloadBlob(
		buffer,
		filename,
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	);
}
