/**
 * Export DataGrid rows to a styled PDF matching the Purchase Order format
 * (sample_3MP_PO.pdf).
 *
 * Uses @cj-tech-master/excelts:
 *   - Workbook for layout + styling
 *   - Image (via workbook.addImage + worksheet.addImage) for the company logo
 *   - excelToPdf() to render the workbook as a PDF
 *
 * This module is the thin orchestrator — actual section rendering lives
 * in `pdf-layout.ts` and pure utilities in `pdf-helpers.ts`.
 */
import { Workbook } from "@cj-tech-master/excelts";
import { excelToPdf } from "@cj-tech-master/excelts/pdf";
import dayjs from "dayjs";
import {
	renderCompanyHeader,
	renderDataRows,
	renderInfoFields,
	renderPrincipalInfo,
	renderSignatureBlock,
	renderSummaryRows,
	renderTableHeader,
	setColumnWidths,
} from "./pdf-layout";
import {
	computeSummary,
	resolveLogo,
	shouldInsertPageBreak,
} from "./pdf-helpers";

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
	/** Principal / supplier name displayed prominently in the header */
	principalName?: string;
	/** Principal address line 1 */
	principalAddress1?: string;
	/** Principal address line 2 */
	principalAddress2?: string;
	/** Date string (defaults to today) */
	date?: string;
	/** Terms (defaults to "30 days") */
	terms?: string;
	/** Attn name */
	attn?: string;
	/** Note */
	note?: string;
	/** Prepared by name */
	preparedBy?: string;
	/** Endorsed by name */
	endorsedBy?: string;
	/** Checked by name */
	checkedBy?: string;
	/** Approved by name */
	approvedBy?: string;
	/** Noted by name */
	notedBy?: string;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Generate a Purchase Order PDF from DataGrid rows.
 *
 * Layout:
 *   1. Logo (top-left) + Company info (left) + "PURCHASE ORDER" (right)
 *   2. Principal name
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
		principalName,
		principalAddress1 = "",
		principalAddress2 = "",
		date,
		terms = "30 days",
		attn = "",
		note = "",
		preparedBy = "",
		endorsedBy = "",
		checkedBy = "",
		approvedBy = "",
		notedBy = "",
	} = options ?? {};

	const workbook = new Workbook();
	const ws = workbook.addWorksheet("PURCHASE ORDER");

	// ── Resolve logo ──────────────────────────────────────────────────────
	const { imageId, extWidth, extHeight } = await resolveLogo(
		workbook,
		logoBuffer,
		logoUrl,
	);

	const poNum = poReference || `PO-${dayjs().format("YYYYMMDD-HHmmss")}`;
	const todayStr = date
		? dayjs(date).format("MMMM D, YYYY")
		: dayjs().format("MMMM D, YYYY");

	// ── Build sections in sequence ────────────────────────────────────────
	let rowNum = 1;

	rowNum = renderCompanyHeader(ws, rowNum, imageId, extWidth, extHeight, poNum);
	rowNum = renderPrincipalInfo(ws, rowNum, principalName, principalAddress1, principalAddress2);
	rowNum = renderInfoFields(ws, rowNum, todayStr, terms, attn, note);
	rowNum = renderTableHeader(ws, rowNum);
	rowNum = renderDataRows(ws, rowNum, rows);

	// ── Summary ────────────────────────────────────────────────────────────
	const summary = computeSummary(rows);

	// Conditional page break before summary group
	if (shouldInsertPageBreak(rows.length, 80)) {
		ws.getRow(rowNum - 1).addPageBreak();
	}

	rowNum = renderSummaryRows(ws, rowNum, summary);

	// ── Signature block ────────────────────────────────────────────────────
	// Conditional page break before signature block
	if (
		shouldInsertPageBreak(rows.length, 150, {
			availPagePt: 732,
			additionalHeightPt: 80,
		})
	) {
		ws.getRow(rowNum - 1).addPageBreak();
	}

	rowNum = renderSignatureBlock(ws, rowNum, {
		preparedBy,
		checkedBy,
		endorsedBy,
		notedBy,
		approvedBy,
	});

	// ── Column widths ──────────────────────────────────────────────────────
	setColumnWidths(ws);

	// ── Convert to PDF ─────────────────────────────────────────────────────
	const pdfBuffer = await excelToPdf(workbook, {
		pageSize: "LETTER",
		margins: {
			top: 20,
			right: 20,
			bottom: 20,
			left: 20,
		},
		showPageNumbers: true,
	});

	return pdfBuffer;
}
