/**
 * Pure utility functions and layout helpers for DataGrid → Excel export.
 *
 * Responsibilities:
 *  - Resolving cell values (respecting `valueGetter`)
 *  - Building the workbook row layout
 *  - Applying merged cells
 *  - Applying cell styles to each row type
 *  - Auto-sizing column widths
 */
import type {
	GridColDef,
	GridColumnGroupingModel,
} from "@mui/x-data-grid";
import type { Worksheet } from "@cj-tech-master/excelts";
import {
	ALIGN_CENTER,
	ALIGN_CENTER_WRAP,
	ALIGN_LEFT,
	ALIGN_RIGHT,
	BORDER_BOTTOM_LIGHT,
	BORDER_THIN_ALL,
	FILL_GROUP_HEADER,
	FILL_HEADER,
	FONT_DATA,
	FONT_HEADER_BOLD,
	FONT_SUBTITLE,
	FONT_TITLE,
	rowHighlightFill,
} from "./excel-styles";

// ─── Value resolution ───────────────────────────────────────────────────────

/**
 * Collect leaf-column indices for a column group.
 */
export function groupColumnIndices(
	group: GridColumnGroupingModel[number],
	columns: GridColDef[],
): number[] {
	const indices: number[] = [];
	for (const child of group.children) {
		if (!("children" in child)) {
			const idx = columns.findIndex(
				(c) => c.field === (child as { field: string }).field,
			);
			if (idx >= 0) indices.push(idx);
		}
	}
	return indices;
}

/**
 * Resolve every cell value in the grid, respecting each column's `valueGetter`.
 */
export function resolveDataValues(
	rows: Record<string, unknown>[],
	columns: GridColDef[],
): unknown[][] {
	return rows.map((row) =>
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
}

/**
 * Returns the display name for each column (`headerName` fallback `field`).
 */
export function resolveHeaders(columns: GridColDef[]): string[] {
	return columns.map((col) => col.headerName ?? col.field);
}

// ─── Layout constants ───────────────────────────────────────────────────────

export interface ExcelRowLayout {
	titleRow: number;
	subtitleRow: number;
	groupHeaderRow: number;
	headerRow: number;
	dataStartRow: number;
	dataEndRow: number;
}

/**
 * Build workbook rows — title, subtitle, spacer, group headers, column headers,
 * and data rows.  Returns the row numbers of each section for later styling.
 *
 * Row layout (1‑based):
 *   1        — title (if set)
 *   2        — subtitle (if set)
 *   3        — empty spacer
 *   4        — column group header row (if columnGroupingModel is set)
 *   5        — individual column headers
 *   6+       — data rows
 */
export function buildExcelRows(
	sheet: Worksheet,
	title: string | undefined,
	subtitle: string | undefined,
	headers: string[],
	dataValues: unknown[][],
	hasGroups: boolean,
	columnGroupingModel: GridColumnGroupingModel | undefined,
	columns: GridColDef[],
): ExcelRowLayout {
	const numCols = columns.length;

	let titleRow = -1;
	let subtitleRow = -1;
	let groupHeaderRow = -1;
	let headerRow = -1;
	let rowNum = 1;

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
			const indices = groupColumnIndices(group, columns);
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

	return {
		titleRow,
		subtitleRow,
		groupHeaderRow,
		headerRow,
		dataStartRow,
		dataEndRow: rowNum,
	};
}

// ─── Merges ─────────────────────────────────────────────────────────────────

export function applyExcelMerges(
	sheet: Worksheet,
	layout: ExcelRowLayout,
	columnGroupingModel: GridColumnGroupingModel | undefined,
	columns: GridColDef[],
	numCols: number,
): void {
	const { titleRow, subtitleRow, groupHeaderRow } = layout;

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
	if (groupHeaderRow >= 1 && columnGroupingModel) {
		for (const group of columnGroupingModel) {
			const indices = groupColumnIndices(group, columns);
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
}

// ─── Style application ──────────────────────────────────────────────────────

export function applyTitleStyle(sheet: Worksheet, titleRow: number): void {
	if (titleRow < 1) return;
	const c = sheet.getCell(titleRow, 1);
	c.font = FONT_TITLE;
	c.alignment = ALIGN_CENTER;
}

export function applySubtitleStyle(sheet: Worksheet, subtitleRow: number): void {
	if (subtitleRow < 1) return;
	const c = sheet.getCell(subtitleRow, 1);
	c.font = FONT_SUBTITLE;
	c.alignment = ALIGN_CENTER;
}

export function applyGroupHeaderRowStyles(
	sheet: Worksheet,
	groupHeaderRow: number,
	numCols: number,
): void {
	if (groupHeaderRow < 1) return;
	for (let C = 1; C <= numCols; C++) {
		const c = sheet.getCell(groupHeaderRow, C);
		c.font = FONT_HEADER_BOLD;
		c.fill = FILL_GROUP_HEADER;
		c.alignment = ALIGN_CENTER_WRAP;
		c.border = BORDER_THIN_ALL;
	}
}

export function applyHeaderRowStyles(
	sheet: Worksheet,
	headerRow: number,
	numCols: number,
): void {
	for (let C = 1; C <= numCols; C++) {
		const c = sheet.getCell(headerRow, C);
		c.font = FONT_HEADER_BOLD;
		c.fill = FILL_HEADER;
		c.alignment = ALIGN_CENTER_WRAP;
		c.border = BORDER_THIN_ALL;
	}
}

export function applyDataRowStyles(
	sheet: Worksheet,
	dataStartRow: number,
	dataEndRow: number,
	numCols: number,
	rows: Record<string, unknown>[],
	columns: Pick<GridColDef, "type">[],
	getRowFill?: ((row: Record<string, unknown>) => string | null) | null,
): void {
	for (let R = dataStartRow; R < dataEndRow; R++) {
		const dataRow = rows[R - dataStartRow];
		const fillColor = getRowFill?.(dataRow) ?? null;

		for (let C = 1; C <= numCols; C++) {
			const c = sheet.getCell(R, C);
			const isNumber =
				typeof c.value === "number" ||
				(columns[C - 1]?.type === "number" && c.value != null);

			c.font = FONT_DATA;
			c.alignment = isNumber ? ALIGN_RIGHT : ALIGN_LEFT;
			c.border = BORDER_BOTTOM_LIGHT;

			if (fillColor) {
				c.fill = rowHighlightFill(fillColor);
			}
		}
	}
}

// ─── Column auto-sizing ─────────────────────────────────────────────────────

export function autoSizeColumns(
	sheet: Worksheet,
	numCols: number,
	headers: string[],
	dataValues: unknown[][],
): void {
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
}
