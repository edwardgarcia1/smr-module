import { Workbook } from "@cj-tech-master/excelts";
import type {
	GridColDef,
	GridColumnGroupingModel,
} from "@mui/x-data-grid";
import { downloadBlob } from "./download";
import {
	applyDataRowStyles,
	applyExcelMerges,
	applyGroupHeaderRowStyles,
	applyHeaderRowStyles,
	applySubtitleStyle,
	applyTitleStyle,
	autoSizeColumns,
	buildExcelRows,
	resolveDataValues,
	resolveHeaders,
} from "./excel-helpers";

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

	// ── Resolve cell values ──────────────────────────────────────────────
	const headers = resolveHeaders(columns);
	const dataValues = resolveDataValues(rows, columns);

	// ── Build workbook ───────────────────────────────────────────────────
	const workbook = new Workbook();
	const sheet = workbook.addWorksheet("Data");
	const layout = buildExcelRows(
		sheet,
		title,
		subtitle,
		headers,
		dataValues,
		hasGroups,
		columnGroupingModel,
		columns,
	);

	// ── Merges ───────────────────────────────────────────────────────────
	applyExcelMerges(sheet, layout, columnGroupingModel, columns, numCols);

	// ── Styles ───────────────────────────────────────────────────────────
	applyTitleStyle(sheet, layout.titleRow);
	applySubtitleStyle(sheet, layout.subtitleRow);
	applyGroupHeaderRowStyles(sheet, layout.groupHeaderRow, numCols);
	applyHeaderRowStyles(sheet, layout.headerRow, numCols);
	applyDataRowStyles(
		sheet,
		layout.dataStartRow,
		layout.dataEndRow,
		numCols,
		rows,
		columns,
		getRowFill ?? null,
	);

	// ── Auto-size columns ────────────────────────────────────────────────
	autoSizeColumns(sheet, numCols, headers, dataValues);

	// ── Build workbook & download ────────────────────────────────────────
	const buffer = await workbook.xlsx.writeBuffer();
	downloadBlob(
		buffer,
		filename,
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	);
}
