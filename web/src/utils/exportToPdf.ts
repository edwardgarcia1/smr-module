/**
 * Export DataGrid rows to a styled PDF matching the Purchase Order format
 * (sample_3MP_PO.pdf).
 *
 * Uses @cj-tech-master/excelts:
 *   - Workbook for layout + styling
 *   - Image (via workbook.addImage + worksheet.addImage) for the company logo
 *   - excelToPdf() to render the workbook as a PDF
 */
import { Workbook } from "@cj-tech-master/excelts";
import { excelToPdf } from "@cj-tech-master/excelts/pdf";
import dayjs from "dayjs";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PurchaseOrderExportRow {
	invtID: string;
	descr: string;
	qtyPerCS: number;
	price_perCS?: number | null;
	/** Final order quantity in CS (customOrder ?? suggestedOrderCS) */
	finalOrderCS?: number | null;
	/** Monetary amount (qty × price per CS) */
	amount?: number | null;
}

export interface PurchaseOrderExportOptions {
	/** Company logo image (ArrayBuffer or Uint8Array) */
	logoBuffer?: ArrayBuffer | Uint8Array | null;
	/** PO reference number (defaults to auto-generated) */
	poReference?: string;
	/** Date string (defaults to today) */
	date?: string;
	/** Terms (defaults to "30 days") */
	terms?: string;
	/** Attn name */
	attn?: string;
	/** Note */
	note?: string;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const COMPANY_NAME = "MLDI";
const COMPANY_ADDRESS_LINE1 = "9 Temasek Boulevard, #24-01, Suntec Tower Two";
const COMPANY_ADDRESS_LINE2 = "Singapore 038989";

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Generate a Purchase Order PDF from DataGrid rows.
 *
 * Layout matches `sample_3MP_PO.pdf`:
 *   1. Logo (top-right) + Company info
 *   2. Title "PURCHASE ORDER" + PO number
 *   3. Info fields: Date, Terms, Attn, Note
 *   4. Table with mapped columns
 *   5. Summary row (total / VAT / grand total)
 *   6. Signature block
 *
 * @param rows      - Array of row data with the mapped fields
 * @param logoUrl   - Resolved URL of the logo image (from Vite asset import)
 * @param options   - Optional overrides
 * @returns         - Uint8Array of the generated PDF
 */
export async function exportPurchaseOrderToPdf(
	rows: PurchaseOrderExportRow[],
	logoUrl?: string,
	options?: PurchaseOrderExportOptions,
): Promise<Uint8Array> {
	const {
		logoBuffer,
		poReference,
		date,
		terms = "30 days",
		attn = "",
		note = "",
	} = options ?? {};

	const workbook = new Workbook();
	const ws = workbook.addWorksheet("PURCHASE ORDER");

	// ── Resolve logo buffer ────────────────────────────────────────────
	let logoImageId: number | undefined;
	const rawLogoBuffer = logoBuffer
		? logoBuffer instanceof ArrayBuffer
			? new Uint8Array(logoBuffer)
			: logoBuffer
		: undefined;

	if (rawLogoBuffer) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		logoImageId = workbook.addImage({
			name: "logo",
			extension: "jpeg",
			buffer: rawLogoBuffer,
		} as any);
	} else if (logoUrl) {
		try {
			const resp = await fetch(logoUrl);
			const ab = await resp.arrayBuffer();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			logoImageId = workbook.addImage({
				name: "logo",
				extension: "jpeg",
				buffer: new Uint8Array(ab),
			} as any);
		} catch {
			// Silently skip logo on fetch failure
		}
	}

	// ── Layout constants ───────────────────────────────────────────────
	const PKG_COL = 1;
	const CS_COL = 2;
	const DESC_COL = 3;
	const QTY_COL = 4;
	const U_PRICE_COL = 5;
	const AMOUNT_COL = 6;
	const NUM_COLS = 6;

	// ── Row pointer ────────────────────────────────────────────────────
	let rowNum = 1;

	// ── 1. Company header (logo + name) ────────────────────────────────
	if (logoImageId != null) {
		// Place logo in top-right
		ws.addImage(logoImageId, {
			tl: { col: 5, row: 0 },
			ext: { width: 180, height: 60 },
		});
	}

	// Row 1: Company name (left side)
	ws.getCell(rowNum, 1).value = COMPANY_NAME;
	ws.getCell(rowNum, 1).font = { bold: true, size: 16, name: "Calibri" };
	rowNum++;

	// Row 2: Address line 1
	ws.getCell(rowNum, 1).value = COMPANY_ADDRESS_LINE1;
	ws.getCell(rowNum, 1).font = { size: 9, name: "Calibri", color: { argb: "FF555555" } };
	rowNum++;

	// Row 3: Address line 2
	ws.getCell(rowNum, 1).value = COMPANY_ADDRESS_LINE2;
	ws.getCell(rowNum, 1).font = { size: 9, name: "Calibri", color: { argb: "FF555555" } };
	rowNum++;

	// Row 4: Empty spacer
	rowNum++;

	// ── 2. Title + PO number ───────────────────────────────────────────
	const poNum = poReference || `PO-${dayjs().format("YYYYMMDD-HHmmss")}`;
	ws.getCell(rowNum, 1).value = "PURCHASE ORDER";
	ws.getCell(rowNum, 1).font = { bold: true, size: 14, name: "Calibri" };
	ws.getCell(rowNum, 1).alignment = { horizontal: "center", vertical: "middle" };
	ws.mergeCells(rowNum, 1, rowNum, NUM_COLS);
	rowNum++;

	// PO number row
	ws.getCell(rowNum, 1).value = `P.O. # ${poNum}`;
	ws.getCell(rowNum, 1).font = { bold: true, size: 11, name: "Calibri" };
	ws.getCell(rowNum, 1).alignment = { horizontal: "center", vertical: "middle" };
	ws.mergeCells(rowNum, 1, rowNum, NUM_COLS);
	rowNum++;

	// ── 3. Info fields ─────────────────────────────────────────────────
	const todayStr = date
		? dayjs(date).format("MMMM D, YYYY")
		: dayjs().format("MMMM D, YYYY");
	const infoValueFont = { size: 10, name: "Calibri" };

	// NOTE field (full width, top)
	ws.getCell(rowNum, 1).value = `DATE: ${todayStr}`;
	ws.getCell(rowNum, 1).font = infoValueFont;
	ws.mergeCells(rowNum, 1, rowNum, 3);

	ws.getCell(rowNum, 4).value = `TERMS: ${terms}`;
	ws.getCell(rowNum, 4).font = infoValueFont;
	ws.mergeCells(rowNum, 4, rowNum, NUM_COLS);
	rowNum++;

	// ATTN field
	ws.getCell(rowNum, 1).value = `ATTN: ${attn || "______________________"}`;
	ws.getCell(rowNum, 1).font = infoValueFont;
	ws.mergeCells(rowNum, 1, rowNum, 3);

	ws.getCell(rowNum, 4).value = `NOTE: ${note || "Full Case"}`;
	ws.getCell(rowNum, 4).font = infoValueFont;
	ws.mergeCells(rowNum, 4, rowNum, NUM_COLS);
	rowNum++;

	// Empty spacer
	rowNum++;

	// ── 4. Table header ────────────────────────────────────────────────
	const headerLabels = [
		"3M Stock No.",
		"CS",
		"PRODUCT DESCRIPTION",
		"QTY",
		"Transfer Price\nwithout VAT",
		"Amount",
	];

	for (let c = 1; c <= NUM_COLS; c++) {
		const cell = ws.getCell(rowNum, c);
		cell.value = headerLabels[c - 1];
		cell.font = { bold: true, size: 9, name: "Calibri" };
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
		cell.border = {
			top: { style: "thin", color: { argb: "FFB0B0B0" } },
			bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
			left: { style: "thin", color: { argb: "FFB0B0B0" } },
			right: { style: "thin", color: { argb: "FFB0B0B0" } },
		};
	}
	rowNum++;

	// ── 5. Data rows ──────────────────────────────────────────────────
	for (const row of rows) {
		const rowIdx = rowNum;

		// PKG / Stock No. (column 1)
		ws.getCell(rowIdx, PKG_COL).value = row.invtID;
		ws.getCell(rowIdx, PKG_COL).font = { size: 10, name: "Calibri" };
		ws.getCell(rowIdx, PKG_COL).alignment = { horizontal: "left", vertical: "middle" };

		// CS (column 2) — qtyPerCS
		ws.getCell(rowIdx, CS_COL).value = row.qtyPerCS;
		ws.getCell(rowIdx, CS_COL).font = { size: 10, name: "Calibri" };
		ws.getCell(rowIdx, CS_COL).alignment = { horizontal: "center", vertical: "middle" };

		// PRODUCT DESCRIPTION (column 3)
		ws.getCell(rowIdx, DESC_COL).value = row.descr;
		ws.getCell(rowIdx, DESC_COL).font = { size: 10, name: "Calibri" };
		ws.getCell(rowIdx, DESC_COL).alignment = { horizontal: "left", vertical: "middle" };

		// QTY (column 4) — finalOrderCS
		const qty = row.finalOrderCS ?? 0;
		ws.getCell(rowIdx, QTY_COL).value = qty;
		ws.getCell(rowIdx, QTY_COL).font = { size: 10, name: "Calibri" };
		ws.getCell(rowIdx, QTY_COL).alignment = { horizontal: "right", vertical: "middle" };

		// Transfer Price / Per CS (column 5)
		ws.getCell(rowIdx, U_PRICE_COL).value = row.price_perCS ?? 0;
		ws.getCell(rowIdx, U_PRICE_COL).font = { size: 10, name: "Calibri" };
		ws.getCell(rowIdx, U_PRICE_COL).alignment = { horizontal: "right", vertical: "middle" };
		ws.getCell(rowIdx, U_PRICE_COL).numFmt = "#,##0.00";

		// Amount (column 6)
		const amt = row.amount ?? 0;
		ws.getCell(rowIdx, AMOUNT_COL).value = amt;
		ws.getCell(rowIdx, AMOUNT_COL).font = { size: 10, name: "Calibri" };
		ws.getCell(rowIdx, AMOUNT_COL).alignment = { horizontal: "right", vertical: "middle" };
		ws.getCell(rowIdx, AMOUNT_COL).numFmt = "#,##0.00";

		// Borders for data rows
		for (let c = 1; c <= NUM_COLS; c++) {
			ws.getCell(rowIdx, c).border = {
				bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
			};
		}

		rowNum++;
	}

	// ── 6. Summary rows ────────────────────────────────────────────────
	const totalAmount = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
	const vatAmount = Math.round(totalAmount * 0.12 * 100) / 100;
	const grandTotal = totalAmount + vatAmount;
	// LP (List Price) = total × 1.2 markup, then × 1.12 VAT = × 1.344
	const lpTotal = Math.round(totalAmount * 1.2 * 100) / 100;

	// Empty spacer
	rowNum++;

	// Total Amount row
	ws.getCell(rowNum, 1).value = "Total Amount";
	ws.getCell(rowNum, 1).font = { bold: true, size: 10, name: "Calibri" };
	ws.mergeCells(rowNum, 1, rowNum, 4);
	ws.getCell(rowNum, 5).value = "";
	ws.getCell(rowNum, 6).value = totalAmount;
	ws.getCell(rowNum, 6).font = { bold: true, size: 10, name: "Calibri" };
	ws.getCell(rowNum, 6).alignment = { horizontal: "right", vertical: "middle" };
	ws.getCell(rowNum, 6).numFmt = "#,##0.00";
	rowNum++;

	// VAT row
	ws.getCell(rowNum, 1).value = "VAT 12%";
	ws.getCell(rowNum, 1).font = { size: 10, name: "Calibri" };
	ws.mergeCells(rowNum, 1, rowNum, 4);
	ws.getCell(rowNum, 5).value = "";
	ws.getCell(rowNum, 6).value = vatAmount;
	ws.getCell(rowNum, 6).font = { size: 10, name: "Calibri" };
	ws.getCell(rowNum, 6).alignment = { horizontal: "right", vertical: "middle" };
	ws.getCell(rowNum, 6).numFmt = "#,##0.00";
	rowNum++;

	// Total Amount w/ VAT
	ws.getCell(rowNum, 1).value = "Total Amount w/ VAT";
	ws.getCell(rowNum, 1).font = { bold: true, size: 10, name: "Calibri" };
	ws.mergeCells(rowNum, 1, rowNum, 4);
	ws.getCell(rowNum, 6).value = grandTotal;
	ws.getCell(rowNum, 6).font = { bold: true, size: 10, name: "Calibri" };
	ws.getCell(rowNum, 6).alignment = { horizontal: "right", vertical: "middle" };
	ws.getCell(rowNum, 6).numFmt = "#,##0.00";
	rowNum++;

	// Total @ LP
	ws.getCell(rowNum, 1).value = "Total Amount @ LP:";
	ws.getCell(rowNum, 1).font = { size: 10, name: "Calibri" };
	ws.mergeCells(rowNum, 1, rowNum, 4);
	ws.getCell(rowNum, 6).value = lpTotal;
	ws.getCell(rowNum, 6).font = { size: 10, name: "Calibri" };
	ws.getCell(rowNum, 6).alignment = { horizontal: "right", vertical: "middle" };
	ws.getCell(rowNum, 6).numFmt = "#,##0.00";
	rowNum++;

	// ── 7. Signature block ─────────────────────────────────────────────
	rowNum++; // spacer

	const signatureLabels = [
		"Prepared by:",
		"Checked by:",
		"Noted by:",
		"Endorsed by:",
		"Approved by:",
	];

	// Signature labels in columns 1-3, names/signatures in columns 4-6
	const halfCols = Math.floor(NUM_COLS / 2);
	for (let i = 0; i < signatureLabels.length; i++) {
		const c = i < 3 ? 1 : 4;
		const r = i < 3 ? rowNum + i : rowNum + i - 3;

		ws.getCell(r, c).value = signatureLabels[i];
		ws.getCell(r, c).font = { size: 10, name: "Calibri" };
		ws.getCell(r, c).alignment = { vertical: "middle" };
		if (halfCols > 1) {
			ws.mergeCells(r, c, r, c + halfCols - 1);
		}
	}

	// ── Column widths ──────────────────────────────────────────────────
	ws.getColumn(1).width = 18;
	ws.getColumn(2).width = 10;
	ws.getColumn(3).width = 45;
	ws.getColumn(4).width = 14;
	ws.getColumn(5).width = 18;
	ws.getColumn(6).width = 18;

	// ── Convert to PDF ─────────────────────────────────────────────────
	const pdfBuffer = await excelToPdf(workbook, {
		pageSize: "A4",
		margins: {
			top: 20,
			right: 20,
			bottom: 20,
			left: 20,
		},
	});

	return pdfBuffer;
}


