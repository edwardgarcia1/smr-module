/**
 * Pure utility functions for Purchase Order PDF generation.
 *
 * Concerns:
 *  - Logo buffer resolution & dimension computation
 *  - Financial summary calculations (totals, VAT, grand total, LP)
 *  - Page break heuristics
 *  - Reusable style / font / border constants for the PDF layout
 */
import type { Workbook } from "@cj-tech-master/excelts";
import type { PurchaseOrderExportRow } from "./exportToPdf";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LogoResult {
	imageId: number | undefined;
	extWidth: number;
	extHeight: number;
}

export interface SummaryData {
	totalAmount: number;
	totalQty: number;
	vatAmount: number;
	grandTotal: number;
	lpTotal: number;
}

// ─── Logo resolution ────────────────────────────────────────────────────────

/**
 * Resolve the company logo:
 * 1. Use `logoBuffer` directly if provided.
 * 2. Otherwise fetch from `logoUrl`.
 * 3. Register with the workbook and compute aspect-ratio-aware dimensions.
 *
 * @returns `imageId` (for `ws.addImage`) and the pixel dimensions to use.
 */
export async function resolveLogo(
	workbook: Workbook,
	logoBuffer?: ArrayBuffer | Uint8Array | null,
	logoUrl?: string,
): Promise<LogoResult> {
	let imageId: number | undefined;
	let extWidth = 300;
	let extHeight = 100;

	const rawLogoBuffer = logoBuffer
		? logoBuffer instanceof ArrayBuffer
			? new Uint8Array(logoBuffer)
			: logoBuffer
		: undefined;

	let imageBuffer: Uint8Array | undefined;
	if (rawLogoBuffer) {
		imageBuffer = rawLogoBuffer;
	} else if (logoUrl) {
		try {
			const resp = await fetch(logoUrl);
			const ab = await resp.arrayBuffer();
			imageBuffer = new Uint8Array(ab);
		} catch {
			// Silently skip logo on fetch failure
		}
	}

	if (imageBuffer) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(imageId as any) = (workbook as any).addImage({
			name: "logo",
			extension: "jpeg",
			buffer: imageBuffer,
		});

		try {
			const blob = new Blob([imageBuffer as BlobPart], {
				type: "image/jpeg",
			});
			const blobUrl = URL.createObjectURL(blob);
			const img = new Image();
			img.src = blobUrl;
			await img.decode();
			URL.revokeObjectURL(blobUrl);

			const aspectRatio = img.naturalWidth / img.naturalHeight;
			const maxW = 300;
			const maxH = 100;
			if (aspectRatio > maxW / maxH) {
				extWidth = maxW;
				extHeight = Math.round(maxW / aspectRatio);
			} else {
				extHeight = maxH;
				extWidth = Math.round(maxH * aspectRatio);
			}
		} catch {
			// Fall back to hardcoded dimensions
		}
	}

	return { imageId, extWidth, extHeight };
}

// ─── Financial summary ──────────────────────────────────────────────────────

/**
 * Compute summary figures from the export rows.
 */
export function computeSummary(rows: PurchaseOrderExportRow[]): SummaryData {
	const totalAmount = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
	const totalQty = rows.reduce((sum, r) => sum + (r.finalOrderCS ?? 0), 0);
	const vatAmount = Math.round(totalAmount * 0.12 * 100) / 100;
	const grandTotal = totalAmount + vatAmount;
	// LP (List Price) = total × 1.2 markup, then × 1.12 VAT = × 1.344
	const lpTotal = Math.round(totalAmount * 1.2 * 100) / 100;

	return { totalAmount, totalQty, vatAmount, grandTotal, lpTotal };
}

// ─── Page break heuristics ──────────────────────────────────────────────────

export interface PageBreakConfig {
	/** Available vertical space on a Letter page (pt). Default 737. */
	availPagePt?: number;
	/** Estimated fixed header height (pt). Default 200. */
	fixedHeaderPt?: number;
	/** Additional non-data height already consumed (pt). Default 0. */
	additionalHeightPt?: number;
	/** Height of a single data row (pt). Default 26. */
	dataRowPt?: number;
	/** Safety buffer (pt). Default 10. */
	bufferPt?: number;
}

/**
 * Determine whether a page break is needed before a section with the given
 * estimated height, based on how many data rows have been rendered so far.
 *
 * Uses a heuristic that estimates total used height on the current page and
 * checks whether the remaining space is sufficient.
 */
export function shouldInsertPageBreak(
	dataRowCount: number,
	sectionHeightPt: number,
	config: PageBreakConfig = {},
): boolean {
	const AVAIL_PT = config.availPagePt ?? 737;
	const HEADER_EST_PT = config.fixedHeaderPt ?? 200;
	const DATA_ROW_PT = config.dataRowPt ?? 26;
	const BUFFER_PT = config.bufferPt ?? 10;
	const additional = config.additionalHeightPt ?? 0;

	const totalPt = HEADER_EST_PT + dataRowCount * DATA_ROW_PT + additional;
	const usedOnPage = totalPt % AVAIL_PT;
	const remainPt = usedOnPage === 0 ? 0 : AVAIL_PT - usedOnPage;

	return remainPt < sectionHeightPt + BUFFER_PT;
}

// ─── Style / font / border constants for PDF layout ─────────────────────────

export const FONT_CALIBRI = "Calibri";

export const HEADER_SMALL = {
	size: 9,
	name: FONT_CALIBRI,
	color: { argb: "FF555555" },
};

export const INFO_LABEL_FONT = { bold: true, size: 10, name: FONT_CALIBRI };
export const INFO_VALUE_FONT = { size: 10, name: FONT_CALIBRI };

export const TABLE_HEADER_HEIGHT = 32;
export const DATA_ROW_HEIGHT = 26;
export const SUMMARY_ROW_HEIGHT = 18;

export const THICK_BORDER = {
	top: { style: "thick" as const, color: { argb: "FF000000" } },
	bottom: { style: "thick" as const, color: { argb: "FF000000" } },
	left: { style: "thick" as const, color: { argb: "FF000000" } },
	right: { style: "thick" as const, color: { argb: "FF000000" } },
};

export const TABLE_BORDER_LIGHT = {
	top: { style: "thin" as const, color: { argb: "FFB0B0B0" } },
	bottom: { style: "thin" as const, color: { argb: "FFB0B0B0" } },
	left: { style: "thin" as const, color: { argb: "FFB0B0B0" } },
	right: { style: "thin" as const, color: { argb: "FFB0B0B0" } },
};

export const DATA_BORDER = {
	bottom: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
};

export const SUMMARY_FONT = { size: 10, name: FONT_CALIBRI };
export const SUMMARY_FONT_BOLD = { bold: true, size: 10, name: FONT_CALIBRI };

export const SIG_LABEL_FONT = { size: 10, name: FONT_CALIBRI };
export const SIG_VALUE_FONT = { size: 10, name: FONT_CALIBRI };
export const SIG_RIGHT_LABEL_FONT = { bold: true, size: 10, name: FONT_CALIBRI };
export const SIG_RIGHT_VALUE_FONT = { bold: true, size: 10, name: FONT_CALIBRI };
