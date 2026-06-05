/**
 * Section builder functions for Purchase Order PDF layout.
 *
 * Each function writes cells into a worksheet section and returns the
 * next available row number (1‑based).  This lets the orchestrator
 * chain sections sequentially.
 *
 * All section builders import style constants from `pdf-helpers` and
 * write directly to the `Worksheet` instance passed in.
 */
import type { Worksheet } from "@cj-tech-master/excelts";
import type { PurchaseOrderExportRow } from "./exportToPdf";
import type { SummaryData } from "./pdf-helpers";
import {
	DATA_BORDER,
	DATA_ROW_HEIGHT,
	FONT_CALIBRI,
	HEADER_SMALL,
	INFO_LABEL_FONT,
	INFO_VALUE_FONT,
	SIG_LABEL_FONT,
	SIG_RIGHT_LABEL_FONT,
	SIG_RIGHT_VALUE_FONT,
	SIG_VALUE_FONT,
	SUMMARY_FONT,
	SUMMARY_FONT_BOLD,
	SUMMARY_ROW_HEIGHT,
	TABLE_BORDER_LIGHT,
	TABLE_HEADER_HEIGHT,
	THICK_BORDER,
} from "./pdf-helpers";

// ─── Column constants ───────────────────────────────────────────────────────

const PKG_COL = 1;
const DESC_COL = 2;
const NUM_COLS = 6;

// ─── 1. Company header ─────────────────────────────────────────────────────

/**
 * Render the company header section:
 * - Logo image (top‑left) if available
 * - Company name (left)
 * - "PURCHASE ORDER" title (right, cols 4-6, merged)
 * - P.O. # and number (cols 4-6, merged, thick border)
 * - Four spacer rows to clear the logo
 */
export function renderCompanyHeader(
	ws: Worksheet,
	rowNum: number,
	logoImageId: number | undefined,
	logoExtWidth: number,
	logoExtHeight: number,
	poNum: string,
): number {
	// Logo on the left
	if (logoImageId != null) {
		ws.addImage(logoImageId, {
			tl: { col: 0, row: 0 },
			ext: { width: logoExtWidth, height: logoExtHeight },
		});
	}

	// Row: Company name (left) + PURCHASE ORDER (right)
	ws.getCell(rowNum, 1).value = "MLDI";
	ws.getCell(rowNum, 1).font = { bold: true, size: 16, name: FONT_CALIBRI };

	ws.getCell(rowNum, 4).value = "PURCHASE ORDER";
	ws.getCell(rowNum, 4).font = { bold: true, size: 16, name: FONT_CALIBRI };
	ws.getCell(rowNum, 4).alignment = {
		horizontal: "center",
		vertical: "middle",
	};
	ws.mergeCells(rowNum, 4, rowNum, NUM_COLS);
	rowNum++;

	// Row: P.O. # (col 4) + number (cols 5-6, merged, thick border)
	ws.getCell(rowNum, 4).value = "P.O. #";
	ws.getCell(rowNum, 4).font = { bold: true, size: 16, name: FONT_CALIBRI };
	ws.getCell(rowNum, 4).alignment = {
		horizontal: "center",
		vertical: "middle",
	};
	ws.getCell(rowNum, 4).border = THICK_BORDER;

	ws.getCell(rowNum, 5).value = poNum;
	ws.getCell(rowNum, 5).font = { size: 16, name: FONT_CALIBRI };
	ws.getCell(rowNum, 5).alignment = {
		horizontal: "center",
		vertical: "middle",
	};
	ws.getCell(rowNum, 5).border = THICK_BORDER;
	ws.mergeCells(rowNum, 5, rowNum, NUM_COLS);
	ws.getRow(rowNum).height = 30;

	// Spacer rows to clear the logo
	rowNum += 4;

	return rowNum;
}

// ─── 2. Principal info ─────────────────────────────────────────────────────

/**
 * Render the principal / supplier name and address lines.
 */
export function renderPrincipalInfo(
	ws: Worksheet,
	rowNum: number,
	principalName: string | undefined,
	principalAddress1: string,
	principalAddress2: string,
): number {
	ws.getCell(rowNum, 1).value = principalName || "";
	ws.getCell(rowNum, 1).font = {
		bold: true,
		size: 12,
		name: FONT_CALIBRI,
		underline: "double",
	};
	ws.getCell(rowNum, 1).alignment = { horizontal: "left", vertical: "middle" };
	ws.mergeCells(rowNum, 1, rowNum, NUM_COLS);
	rowNum++;

	if (principalAddress1) {
		ws.getCell(rowNum, 1).value = principalAddress1;
		ws.getCell(rowNum, 1).font = HEADER_SMALL;
		rowNum++;
	}
	if (principalAddress2) {
		ws.getCell(rowNum, 1).value = principalAddress2;
		ws.getCell(rowNum, 1).font = HEADER_SMALL;
		rowNum++;
	}

	// Empty spacer
	rowNum++;

	return rowNum;
}

// ─── 3. Info fields ────────────────────────────────────────────────────────

/**
 * Render the info field rows: DATE, TERMS, ATTN, NOTE.
 *
 * Each field occupies two columns — label in col 1, value in col 2.
 */
export function renderInfoFields(
	ws: Worksheet,
	rowNum: number,
	todayStr: string,
	terms: string,
	attn: string,
	note: string,
): number {
	const infoLabels = [
		{ label: "DATE:", value: todayStr },
		{ label: "TERMS:", value: terms },
		{ label: "ATTN:", value: attn || "______________________" },
		{ label: "NOTE:", value: note || "Full Case" },
	];

	for (const f of infoLabels) {
		ws.getCell(rowNum, 1).value = f.label;
		ws.getCell(rowNum, 1).font = INFO_LABEL_FONT;
		ws.getCell(rowNum, 1).alignment = {
			horizontal: "left",
			vertical: "middle",
		};

		ws.getCell(rowNum, 2).value = f.value;
		ws.getCell(rowNum, 2).font = INFO_VALUE_FONT;
		ws.getCell(rowNum, 2).alignment = {
			horizontal: "left",
			vertical: "middle",
		};
		rowNum++;
	}

	// Empty spacer
	rowNum++;

	return rowNum;
}

// ─── 4. Table header ────────────────────────────────────────────────────────

const TABLE_HEADER_LABELS = [
	"ID",
	"PRODUCT DESCRIPTION",
	"Units Per CS",
	"Transfer Price\nwithout VAT",
	"QTY (CS)",
	"Amount",
];

/**
 * Render the column header row for the data table.
 */
export function renderTableHeader(
	ws: Worksheet,
	rowNum: number,
): number {
	ws.getRow(rowNum).height = TABLE_HEADER_HEIGHT;
	for (let c = 1; c <= NUM_COLS; c++) {
		const cell = ws.getCell(rowNum, c);
		cell.value = TABLE_HEADER_LABELS[c - 1];
		cell.font = { bold: true, size: 9, name: FONT_CALIBRI };
		cell.alignment = {
			horizontal: "center",
			vertical: "middle",
			wrapText: true,
		};
		cell.fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFF2F2F2" },
		};
		cell.border = TABLE_BORDER_LIGHT;
	}
	rowNum++;
	return rowNum;
}

// ─── 5. Data rows ──────────────────────────────────────────────────────────

/**
 * Render the purchase-order line-item rows.
 */
export function renderDataRows(
	ws: Worksheet,
	rowNum: number,
	rows: PurchaseOrderExportRow[],
): number {
	for (const row of rows) {
		const rowIdx = rowNum;

		// PKG / Stock No. (col 1)
		ws.getCell(rowIdx, PKG_COL).value = row.invtID;
		ws.getCell(rowIdx, PKG_COL).font = { size: 10, name: FONT_CALIBRI };
		ws.getCell(rowIdx, PKG_COL).alignment = {
			horizontal: "left",
			vertical: "middle",
		};

		// PRODUCT DESCRIPTION (col 2)
		ws.getCell(rowIdx, DESC_COL).value = row.descr;
		ws.getCell(rowIdx, DESC_COL).font = { size: 10, name: FONT_CALIBRI };
		ws.getCell(rowIdx, DESC_COL).alignment = {
			horizontal: "left",
			vertical: "middle",
		};

		// Units Per CS (col 3)
		ws.getCell(rowIdx, 3).value = row.qtyPerCS;
		ws.getCell(rowIdx, 3).font = { size: 10, name: FONT_CALIBRI };
		ws.getCell(rowIdx, 3).alignment = {
			horizontal: "center",
			vertical: "middle",
		};

		// Transfer Price / Per CS (col 4)
		ws.getCell(rowIdx, 4).value = row.price_perCS ?? 0;
		ws.getCell(rowIdx, 4).font = { size: 10, name: FONT_CALIBRI };
		ws.getCell(rowIdx, 4).alignment = {
			horizontal: "right",
			vertical: "middle",
		};
		ws.getCell(rowIdx, 4).numFmt = "#,##0.00";

		// QTY (CS) (col 5)
		const qty = row.finalOrderCS ?? 0;
		ws.getCell(rowIdx, 5).value = qty;
		ws.getCell(rowIdx, 5).font = { size: 10, name: FONT_CALIBRI };
		ws.getCell(rowIdx, 5).alignment = {
			horizontal: "right",
			vertical: "middle",
		};

		// Amount (col 6)
		const amt = row.amount ?? 0;
		ws.getCell(rowIdx, 6).value = amt;
		ws.getCell(rowIdx, 6).font = { size: 10, name: FONT_CALIBRI };
		ws.getCell(rowIdx, 6).alignment = {
			horizontal: "right",
			vertical: "middle",
		};
		ws.getCell(rowIdx, 6).numFmt = "#,##0.00";

		ws.getRow(rowIdx).height = DATA_ROW_HEIGHT;

		// Bottom border for all columns
		for (let c = 1; c <= NUM_COLS; c++) {
			ws.getCell(rowIdx, c).border = DATA_BORDER;
		}

		rowNum++;
	}

	return rowNum;
}

// ─── 6. Summary rows ───────────────────────────────────────────────────────

/**
 * Render the financial summary rows:
 *   Total Amount, VAT 12%, Total w/ VAT, Total @ LP.
 */
export function renderSummaryRows(
	ws: Worksheet,
	rowNum: number,
	summary: SummaryData,
): number {
	const { totalQty, totalAmount, vatAmount, grandTotal, lpTotal } = summary;

	// Empty spacer
	rowNum++;

	// ── Total Amount row ──────────────────────────────────────────────────
	ws.getCell(rowNum, 4).value = "Total Amount";
	ws.getCell(rowNum, 4).font = SUMMARY_FONT_BOLD;
	ws.getCell(rowNum, 4).alignment = { horizontal: "right", vertical: "middle" };

	ws.getCell(rowNum, 5).value = totalQty;
	ws.getCell(rowNum, 5).font = SUMMARY_FONT;
	ws.getCell(rowNum, 5).alignment = { horizontal: "right", vertical: "middle" };

	ws.getCell(rowNum, 6).value = totalAmount;
	ws.getCell(rowNum, 6).font = SUMMARY_FONT_BOLD;
	ws.getCell(rowNum, 6).alignment = { horizontal: "right", vertical: "middle" };
	ws.getCell(rowNum, 6).numFmt = "#,##0.00";
	ws.getRow(rowNum).height = SUMMARY_ROW_HEIGHT;
	rowNum++;

	// ── VAT row ───────────────────────────────────────────────────────────
	ws.getCell(rowNum, 4).value = "VAT 12%";
	ws.getCell(rowNum, 4).font = SUMMARY_FONT;
	ws.getCell(rowNum, 4).alignment = { horizontal: "right", vertical: "middle" };

	ws.getCell(rowNum, 6).value = vatAmount;
	ws.getCell(rowNum, 6).font = SUMMARY_FONT;
	ws.getCell(rowNum, 6).alignment = { horizontal: "right", vertical: "middle" };
	ws.getCell(rowNum, 6).numFmt = "#,##0.00";
	ws.getRow(rowNum).height = SUMMARY_ROW_HEIGHT;
	rowNum++;

	// ── Total w/ VAT ──────────────────────────────────────────────────────
	ws.getCell(rowNum, 4).value = "Total w/ VAT";
	ws.getCell(rowNum, 4).font = SUMMARY_FONT_BOLD;
	ws.getCell(rowNum, 4).alignment = { horizontal: "right", vertical: "middle" };

	ws.getCell(rowNum, 6).value = grandTotal;
	ws.getCell(rowNum, 6).font = SUMMARY_FONT_BOLD;
	ws.getCell(rowNum, 6).alignment = { horizontal: "right", vertical: "middle" };
	ws.getCell(rowNum, 6).numFmt = "#,##0.00";
	ws.getRow(rowNum).height = SUMMARY_ROW_HEIGHT;

	// Double line separator before Total @ LP
	for (let c = 4; c <= 6; c++) {
		ws.getCell(rowNum, c).border = {
			bottom: { style: "double", color: { argb: "FF000000" } },
		};
	}
	rowNum++;

	// ── Total @ LP ────────────────────────────────────────────────────────
	ws.getCell(rowNum, 4).value = "Total @ LP";
	ws.getCell(rowNum, 4).font = SUMMARY_FONT;
	ws.getCell(rowNum, 4).alignment = { horizontal: "right", vertical: "middle" };

	ws.getCell(rowNum, 6).value = lpTotal;
	ws.getCell(rowNum, 6).font = SUMMARY_FONT;
	ws.getCell(rowNum, 6).alignment = { horizontal: "right", vertical: "middle" };
	ws.getCell(rowNum, 6).numFmt = "#,##0.00";
	ws.getRow(rowNum).height = 26;
	rowNum++;

	return rowNum;
}

// ─── 7. Signature block ────────────────────────────────────────────────────

const LEFT_SIGNATORIES = [
	{ label: "Prepared by:", key: "preparedBy" as const },
	{ label: "Checked by:", key: "checkedBy" as const },
	{ label: "Endorsed by:", key: "endorsedBy" as const },
];

const RIGHT_SIGNATORIES = [
	{ label: "Noted by:", key: "notedBy" as const },
	{ label: "Approved by:", key: "approvedBy" as const },
];

export interface SignatureValues {
	preparedBy: string;
	checkedBy: string;
	endorsedBy: string;
	notedBy: string;
	approvedBy: string;
}

/**
 * Render the signature block.
 *
 * Layout (each field takes 2 rows: label + value, with 2 spacer rows):
 *
 * Left (cols 1-3):            Right (cols 4-6):
 *   Prepared by:                Noted by:
 *     <name>                      <name>
 *   Checked by:                 Approved by:
 *     <name>                      <name>
 *   Endorsed by:
 *     <name>
 */
export function renderSignatureBlock(
	ws: Worksheet,
	rowNum: number,
	sigs: SignatureValues,
): number {
	// Spacer before signatures
	rowNum++;

	// Left group: cols 1-3
	const leftSignatures = LEFT_SIGNATORIES.map((s) => ({
		label: s.label,
		value: sigs[s.key],
	}));

	const rightSignatures = RIGHT_SIGNATORIES.map((s) => ({
		label: s.label,
		value: sigs[s.key],
	}));

	let r = rowNum;
	for (const s of leftSignatures) {
		ws.getCell(r, 1).value = s.label;
		ws.getCell(r, 1).font = SIG_LABEL_FONT;
		ws.getCell(r, 1).alignment = { vertical: "middle" };
		ws.mergeCells(r, 1, r, 3);

		if (s.value) {
			ws.getCell(r + 1, 2).value = s.value;
			ws.getCell(r + 1, 2).font = SIG_VALUE_FONT;
			ws.getCell(r + 1, 2).alignment = { vertical: "middle" };
			ws.mergeCells(r + 1, 2, r + 1, 3);
		}
		r += 4; // label row + value row + 2 spacer rows
	}

	// Right group: cols 4-6 — starts 2 fields down to align
	// Noted by ↔ Checked by,  Approved by ↔ Endorsed by
	r = rowNum + 4;
	for (const s of rightSignatures) {
		ws.getCell(r, 4).value = s.label;
		ws.getCell(r, 4).font = SIG_RIGHT_LABEL_FONT;
		ws.getCell(r, 4).alignment = { vertical: "middle" };
		ws.mergeCells(r, 4, r, 6);

		if (s.value) {
			ws.getCell(r + 1, 5).value = s.value;
			ws.getCell(r + 1, 5).font = SIG_RIGHT_VALUE_FONT;
			ws.getCell(r + 1, 5).alignment = { vertical: "middle" };
			ws.mergeCells(r + 1, 5, r + 1, 6);
		}
		r += 4;
	}

	// Advance past the tallest column
	rowNum += Math.max(leftSignatures.length, rightSignatures.length) * 4;

	return rowNum;
}

// ─── Column widths ─────────────────────────────────────────────────────────

/**
 * Set fixed column widths for the Purchase Order layout.
 */
export function setColumnWidths(ws: Worksheet): void {
	ws.getColumn(1).width = 18;
	ws.getColumn(2).width = 45;
	ws.getColumn(3).width = 10;
	ws.getColumn(4).width = 13;
	ws.getColumn(5).width = 22;
	ws.getColumn(6).width = 18;
}
