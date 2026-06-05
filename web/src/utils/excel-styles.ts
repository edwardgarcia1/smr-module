/**
 * Reusable style builders for Excel workbook cells.
 *
 * Every export is a plain object literal (or factory) that can be assigned
 * directly to cell properties (`cell.font`, `cell.alignment`, `cell.fill`,
 * `cell.border`) — see `Cell` setter signatures in `@cj-tech-master/excelts`.
 */
import type {
	Alignment,
	Borders,
	Fill,
	Font,
} from "@cj-tech-master/excelts";

// ─── Font constants ─────────────────────────────────────────────────────────

export const FONT_TITLE: Partial<Font> = {
	bold: true,
	size: 14,
	name: "Calibri",
};

export const FONT_SUBTITLE: Partial<Font> = {
	italic: true,
	size: 11,
	name: "Calibri",
	color: { argb: "FF555555" },
};

export const FONT_HEADER_BOLD: Partial<Font> = {
	bold: true,
	size: 10,
	name: "Calibri",
};

export const FONT_DATA: Partial<Font> = {
	size: 10,
	name: "Calibri",
};

// ─── Alignment constants ────────────────────────────────────────────────────

export const ALIGN_CENTER: Partial<Alignment> = {
	horizontal: "center",
	vertical: "middle",
};

export const ALIGN_LEFT: Partial<Alignment> = {
	horizontal: "left",
	vertical: "middle",
};

export const ALIGN_RIGHT: Partial<Alignment> = {
	horizontal: "right",
	vertical: "middle",
};

export const ALIGN_CENTER_WRAP: Partial<Alignment> = {
	horizontal: "center",
	vertical: "middle",
	wrapText: true,
};

// ─── Fill constants ─────────────────────────────────────────────────────────

export const FILL_GROUP_HEADER: Fill = {
	type: "pattern",
	pattern: "solid",
	fgColor: { argb: "FFD9E2F3" },
};

export const FILL_HEADER: Fill = {
	type: "pattern",
	pattern: "solid",
	fgColor: { argb: "FFF2F2F2" },
};

// ─── Border constants ───────────────────────────────────────────────────────

export const BORDER_THIN_ALL: Partial<Borders> = {
	top: { style: "thin", color: { argb: "FFB0B0B0" } },
	bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
	left: { style: "thin", color: { argb: "FFB0B0B0" } },
	right: { style: "thin", color: { argb: "FFB0B0B0" } },
};

export const BORDER_BOTTOM_LIGHT: Partial<Borders> = {
	bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
};

// ─── Factory helpers ────────────────────────────────────────────────────────

/**
 * Returns a fill object for a data-row highlight colour.
 * @param hex6 - 6-character hex string WITHOUT leading `#` (e.g. `"ffcdd2"`)
 */
export function rowHighlightFill(hex6: string): Fill {
	return {
		type: "pattern",
		pattern: "solid",
		fgColor: { argb: `FF${hex6.toUpperCase()}` },
	};
}
