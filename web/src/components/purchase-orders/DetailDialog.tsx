/**
 * DetailDialog — Dialog showing purchase order grid data with inline editing,
 * category filtering, column show/hide, and export capabilities.
 */
import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import {
	Box,
	Dialog,
	DialogContent,
	Typography,
	Skeleton,
} from "@mui/material";
import {
	DataGrid,
	type GridColDef,
	useGridApiRef,
} from "@mui/x-data-grid";
import apiRequest from "../../services/api";
import { useThemeMode } from "../../providers/AppProvider";
import {
	buildGroupColors,
	computeCategoryName,
	periodSortValue,
	getCategoryColors,
	CATEGORY_CLASS_MAP,
	CATEGORY_ORDER,
	CAT_EXCEL_COLORS,
} from "../../config/requirements";
import type {
	MinStockCategory,
	CategoryColorScheme,
	Principal,
} from "../../config/requirements";
import {
	buildBaseGridSx,
	purchasingGroupSelectors,
} from "../requirements/gridStyles";
import {
	type PurchaseOrder,
	type PurchaseOrderDetail,
	type PoStatus,
	DETAIL_COL_ORDER,
	DETAIL_COL_WIDTHS,
	DETAIL_HEADER_LABELS,
	DETAIL_NUMERIC_FIELDS,
	DETAIL_HEADER_GROUPS,
} from "../../config/purchaseOrders";
import DetailGridToolbar from "./DetailGridToolbar";
import TableSkeleton from "../TableSkeleton";
import PoPdfExportDialog from "../requirements/PoPdfExportDialog";
import type { PoPdfExportFormData } from "../requirements/PoPdfExportDialog";
import { exportDataGridToExcel } from "../../utils/exportToExcel";
import { exportPurchaseOrderToPdf } from "../../utils/exportToPdf";
import { downloadBlob } from "../../utils/download";
import { LOGO_OPTIONS } from "../../hooks/useRequirements";
import dayjs from "dayjs";

interface DetailDialogProps {
	open: boolean;
	onClose: () => void;
	po: PurchaseOrder | null;
	onOrderUpdate: (updated: PurchaseOrder) => void;
	categories: MinStockCategory[];
	principals: Principal[];
}

const DetailDialog: React.FC<DetailDialogProps> = ({
	open,
	onClose,
	po,
	onOrderUpdate,
	categories,
	principals,
}) => {
	const [detailData, setDetailData] = useState<PurchaseOrderDetail | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { darkMode } = useThemeMode();
	const groupColors = useMemo(() => buildGroupColors(darkMode), [darkMode]);
	const gridSx = useMemo(
		() =>
			buildBaseGridSx(
				darkMode,
				groupColors,
				purchasingGroupSelectors(groupColors),
			),
		[darkMode, groupColors],
	);

	const detailApiRef = useGridApiRef();
	const detailColumnVisibilityRef = useRef<Record<string, boolean>>({});
	const [detailCategories, setDetailCategories] = useState<string[]>([]);
	const [showDetailDemand, setShowDetailDemand] = useState(true);

	const categoryColors = useMemo(() => getCategoryColors(darkMode), [darkMode]);
	const getCategoryColor = useCallback(
		(cat: string): CategoryColorScheme =>
			categoryColors[cat] ?? {
				bg: "transparent",
				chipBg: "action.selected",
				chipText: "text.primary",
			},
		[categoryColors],
	);

	// Fetch detail data
	useEffect(() => {
		if (!open || !po) return;
		let cancelled = false;
		const fetch = async () => {
			setDetailLoading(true);
			setError(null);
			try {
				const data = await apiRequest<PurchaseOrderDetail>(
					`/purchase-order/${po.id}`,
				);
				if (!cancelled) setDetailData(data);
			} catch (err: unknown) {
				if (!cancelled) {
					setDetailData(null);
					setError(
						err instanceof Error
							? err.message
							: "Failed to load PO details.",
					);
				}
			} finally {
				if (!cancelled) setDetailLoading(false);
			}
		};
		fetch();
		return () => { cancelled = true; };
	}, [open, po]);

	const handleClose = () => {
		setDetailData(null);
		setError(null);
		onClose();
	};

	// Row class name (category highlighting)
	const getRowClassName = useCallback(
		(params: { row: Record<string, unknown> }) => {
			const r = params.row;
			const sc = r.stockCoverCount ? Number(r.stockCoverCount) : null;
			const ct = r.coverageThreshold ? Number(r.coverageThreshold) : null;
			const ad = r.avgDemand ? Number(r.avgDemand) : null;
			const so = r.suggestedOrder ? Number(r.suggestedOrder) : null;
			const cat = computeCategoryName(
				{ stockCoverCount: sc, coverageThreshold: ct, avgDemand: ad, suggestedOrder: so },
				categories,
			);
			return cat ? (CATEGORY_CLASS_MAP[cat] ?? "") : "";
		},
		[categories],
	);

	// Build columns from CSV headers
	const headerColumns = React.useMemo<GridColDef[]>(() => {
		if (!detailData) return [];
		const orderIdx: Record<string, number> = {};
		DETAIL_COL_ORDER.forEach((name, i) => { orderIdx[name] = i; });
		const sortedHeaders = [...detailData.csvData.headers].sort((a, b) => {
			const getKey = (h: string): number => {
				const idx = orderIdx[h];
				if (idx !== undefined) return idx;
				if (h.startsWith("pd_")) return 10.5;
				return 999;
			};
			const ka = getKey(a);
			const kb = getKey(b);
			if (ka !== kb) return ka - kb;
			if (a.startsWith("pd_") && b.startsWith("pd_"))
				return periodSortValue(a.slice(3)) - periodSortValue(b.slice(3));
			if (ka === 999) return a.localeCompare(b);
			return 0;
		});
		return sortedHeaders.map((header) => {
			const isPeriodField = header.startsWith("pd_");
			const isNumeric = DETAIL_NUMERIC_FIELDS.has(header) || isPeriodField;
			const isEditable = header === "customOrder";
			const col: GridColDef = {
				field: header,
				headerName: DETAIL_HEADER_LABELS[header] ?? (isPeriodField ? header.slice(3) : header),
				width: DETAIL_COL_WIDTHS[header] ?? (isPeriodField ? 110 : 130),
				flex: header === "descr" ? 1 : undefined,
				headerClassName: DETAIL_HEADER_GROUPS[header] ?? (isPeriodField ? "group-demand" : undefined),
			};
			if (isNumeric) {
				col.type = "number";
				col.valueFormatter = (value?: string) => {
					if (value == null || value === "") return "";
					const n = Number(value);
					return Number.isNaN(n) ? value : n.toLocaleString(undefined, {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					});
				};
			}
			if (header === "price_ao") {
				col.valueFormatter = (value?: string) => {
					if (!value) return "—";
					try { return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
					catch { return value; }
				};
			}
			if (isEditable) col.editable = true;
			if (header === "amount") {
				col.valueGetter = (_v: unknown, row: Record<string, unknown>) => {
					const qty = (row.customOrder != null && row.customOrder !== "")
						? Number(row.customOrder)
						: (row.suggestedOrderCS != null && row.suggestedOrderCS !== "")
							? Number(row.suggestedOrderCS) : 0;
					const price = (row.price_perCS != null && row.price_perCS !== "") ? Number(row.price_perCS) : null;
					if (price == null) return null;
					return Math.round(qty * price * 100) / 100;
				};
			}
			return col;
		});
	}, [detailData]);

	// Computed columns
	const computedColumns = useMemo<GridColDef[]>(() => {
		if (!detailData) return [];
		const numFmt = (value?: number) => {
			if (value == null) return "";
			return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		};
		return [
			{
				field: "finalOrderCS", headerName: "Final Order (CS)", width: 130, type: "number",
				headerClassName: "group-final-order",
				valueGetter: (_v: unknown, row: Record<string, unknown>) => {
					const c = (row.customOrder != null && row.customOrder !== "") ? Number(row.customOrder) : null;
					const s = (row.suggestedOrderCS != null && row.suggestedOrderCS !== "") ? Number(row.suggestedOrderCS) : null;
					return c != null ? c : s;
				},
				valueFormatter: numFmt,
			},
			{
				field: "orderCover", headerName: "Order Cover (Months)", width: 130, type: "number",
				headerClassName: "group-stock",
				valueGetter: (_v: unknown, row: Record<string, unknown>) => {
					const finalQty = (row.customOrder != null && row.customOrder !== "")
						? Number(row.customOrder)
						: (row.suggestedOrderCS != null && row.suggestedOrderCS !== "") ? Number(row.suggestedOrderCS) : null;
					const avgCS = (row.avgDemandCS != null && row.avgDemandCS !== "") ? Number(row.avgDemandCS) : null;
					if (avgCS == null || avgCS === 0 || finalQty == null) return null;
					return finalQty / avgCS;
				},
				valueFormatter: numFmt,
			},
			{
				field: "incomingCover", headerName: "Incoming Cover (Months)", width: 130, type: "number",
				headerClassName: "group-stock",
				valueGetter: (_v: unknown, row: Record<string, unknown>) => {
					const po2 = row.qtyOnPO != null ? Number(row.qtyOnPO) : null;
					const avg = row.avgDemand != null ? Number(row.avgDemand) : null;
					if (avg == null || avg === 0 || po2 == null) return null;
					return po2 / avg;
				},
				valueFormatter: numFmt,
			},
			{
				field: "totalCover", headerName: "Total Cover (Months)", width: 140, type: "number",
				headerClassName: "group-stock",
				valueGetter: (_v: unknown, row: Record<string, unknown>) => {
					const sc2 = (row.stockCoverCount != null && row.stockCoverCount !== "") ? Number(row.stockCoverCount) : 0;
					const finalQty = (row.customOrder != null && row.customOrder !== "")
						? Number(row.customOrder)
						: (row.suggestedOrderCS != null && row.suggestedOrderCS !== "") ? Number(row.suggestedOrderCS) : null;
					const avgCS = (row.avgDemandCS != null && row.avgDemandCS !== "") ? Number(row.avgDemandCS) : null;
					const po2 = (row.qtyOnPO != null && row.qtyOnPO !== "") ? Number(row.qtyOnPO) : 0;
					const avg = (row.avgDemand != null && row.avgDemand !== "") ? Number(row.avgDemand) : null;
					let orderCover = 0;
					if (avgCS != null && avgCS > 0 && finalQty != null) orderCover = finalQty / avgCS;
					let incomingCover = 0;
					if (avg != null && avg > 0 && po2 > 0) incomingCover = po2 / avg;
					return sc2 + orderCover + incomingCover;
				},
				valueFormatter: numFmt,
			},
			{
				field: "_category", headerName: "Category", width: 130,
				valueGetter: (_v: unknown, row: Record<string, unknown>) => {
					const sc2 = row.stockCoverCount ? Number(row.stockCoverCount) : null;
					const ct2 = row.coverageThreshold ? Number(row.coverageThreshold) : null;
					const ad2 = row.avgDemand ? Number(row.avgDemand) : null;
					const so2 = row.suggestedOrder ? Number(row.suggestedOrder) : null;
					return computeCategoryName({ stockCoverCount: sc2, coverageThreshold: ct2, avgDemand: ad2, suggestedOrder: so2 }, categories);
				},
				sortComparator: (v1: string | null, v2: string | null) => {
					const o1 = v1 ? (CATEGORY_ORDER[v1] ?? 99) : 99;
					const o2 = v2 ? (CATEGORY_ORDER[v2] ?? 99) : 99;
					return o1 - o2;
				},
			},
		];
	}, [detailData, categories]);

	const detailColumns = useMemo<GridColDef[]>(() => {
		const existing = new Set(headerColumns.map((c) => c.field));
		return [...headerColumns, ...computedColumns.filter((c) => !existing.has(c.field))];
	}, [headerColumns, computedColumns]);

	// Inline editing
	const [editedRows, setEditedRows] = useState<Record<number, Record<string, unknown>>>({});
	const editedRowsRef = useRef(editedRows);
	useEffect(() => { editedRowsRef.current = editedRows; }, [editedRows]);

	const handleProcessRowUpdate = useCallback(
		(newRow: Record<string, unknown>) => {
			const rowId = newRow.id as number;
			setEditedRows((prev) => ({ ...prev, [rowId]: newRow }));
			if (po && detailData) {
				const currentEdits = { ...editedRowsRef.current, [rowId]: newRow };
				const mergedRows = detailData.csvData.rows.map((r, i) => {
					const id = i + 1;
					return { ...r, ...(currentEdits[id] ?? {}) };
				});
				apiRequest(`/purchase-order/${po.id}`, {
					method: "PATCH",
					body: { rows: mergedRows },
				}).catch((err) => console.error("Failed to persist inline edit:", err));
			}
			return Promise.resolve(newRow);
		},
		[po, detailData],
	);

	const handleProcessRowUpdateError = useCallback((err: unknown) => {
		console.error("Row update error:", err);
	}, []);

	// Status change
	const handleStatusChange = useCallback(
		async (newStatus: PoStatus) => {
			if (!po) return;
			try {
				const updated = await apiRequest<PurchaseOrder>(
					`/purchase-order/${po.id}/status`,
					{ method: "PATCH", body: { status: newStatus } },
				);
				onOrderUpdate(updated);
			} catch (err) {
				console.error("Failed to update status:", err);
			}
		},
		[po, onOrderUpdate],
	);

	// Excel export
	const handleDetailExcelExport = useCallback(async () => {
		if (!detailData || detailData.csvData.rows.length === 0) return;
		const mergedRows = detailData.csvData.rows.map((r, i) => {
			const id = i + 1;
			return { ...(editedRows[id] ?? r), id };
		});
		const sortedRowIds = detailApiRef.current?.getSortedRowIds() ?? [];
		const rowById = new Map(mergedRows.map((r) => [r.id, r]));
		const sortedRows: Record<string, unknown>[] = [];
		for (const id of sortedRowIds) {
			const row = rowById.get(id as number);
			if (row) sortedRows.push(row);
		}
		const exportRows = sortedRows.length > 0 ? sortedRows : mergedRows;
		await exportDataGridToExcel(
			exportRows, detailColumns,
			{
				title: po?.ref_num ?? "Purchase Order",
				subtitle: po ? `${po.frequency} · ${po.demand_mode} demand · ${po.principal_id}` : undefined,
				getRowFill: (row) => {
					const sc2 = row.stockCoverCount ? Number(row.stockCoverCount) : null;
					const ct2 = row.coverageThreshold ? Number(row.coverageThreshold) : null;
					const ad2 = row.avgDemand ? Number(row.avgDemand) : null;
					const so2 = row.suggestedOrder ? Number(row.suggestedOrder) : null;
					const cat = computeCategoryName({ stockCoverCount: sc2, coverageThreshold: ct2, avgDemand: ad2, suggestedOrder: so2 }, categories);
					return cat ? (CAT_EXCEL_COLORS[cat] ?? null) : null;
				},
			},
			`PO-${po?.ref_num ?? "export"}.xlsx`,
		);
	}, [detailData, detailColumns, po, editedRows, categories, detailApiRef]);

	// Demand column toggle
	const handleToggleDetailDemand = useCallback(() => {
		const newShow = !showDetailDemand;
		setShowDetailDemand(newShow);
		const model = { ...detailColumnVisibilityRef.current };
		for (const col of detailColumns) {
			if (col.field.startsWith("pd_")) {
				if (!newShow) model[col.field] = false;
				else delete model[col.field];
			}
		}
		detailApiRef.current?.setColumnVisibilityModel(model);
	}, [showDetailDemand, detailColumns, detailApiRef]);

	// PDF export
	const [pdfDetailOpen, setPdfDetailOpen] = useState(false);
	const [isDetailPdfExporting, setIsDetailPdfExporting] = useState(false);
	const openDetailPdfDialog = useCallback(() => setPdfDetailOpen(true), []);
	const closeDetailPdfDialog = useCallback(() => setPdfDetailOpen(false), []);

	const handleDetailPdfExport = useCallback(
		async (formData: PoPdfExportFormData) => {
			if (!detailData || detailData.csvData.rows.length === 0) return;
			setIsDetailPdfExporting(true);
			try {
				const mergedRows = detailData.csvData.rows.map((r, i) => {
					const id = i + 1;
					return { ...(editedRows[id] ?? r) };
				});
				const poRows = mergedRows
					.map((r) => {
						const rawFinalQty = (r.customOrder != null && r.customOrder !== "")
							? Number(r.customOrder)
							: (r.suggestedOrderCS != null && r.suggestedOrderCS !== "") ? Number(r.suggestedOrderCS) : 0;
						const finalQty = Math.round(rawFinalQty);
						const price = r.price_perCS ? Number(r.price_perCS) : null;
						return {
							invtID: String(r.invtID ?? ""),
							descr: String(r.descr ?? ""),
							qtyPerCS: Number(r.qtyPerCS) || 0,
							price_perCS: price,
							finalOrderCS: finalQty,
							amount: price != null ? Math.round(finalQty * price * 100) / 100 : null,
						};
					})
					.filter((r) => r.finalOrderCS !== 0);

				const pdfBuffer = await exportPurchaseOrderToPdf(
					poRows, formData.selectedLogoSrc, {
						poReference: formData.poReference,
						principalName: principals.find((p) => p.ClassID === po?.principal_id)?.Descr?.trim() || po?.principal_id || "Principal",
						principalAddress1: po?.site_id ?? "",
						date: dayjs().format("YYYY-MM-DD"),
						attn: formData.attn,
						preparedBy: formData.preparedBy,
						endorsedBy: formData.endorsedBy,
						checkedBy: formData.checkedBy,
						approvedBy: formData.approvedBy,
						notedBy: formData.notedBy,
					},
				);
				downloadBlob(pdfBuffer, `PO-${formData.poReference}.pdf`, "application/pdf");
				setPdfDetailOpen(false);

				// Auto-update status to Printed
				if (po && po.status !== "Printed") {
					try {
						const updated = await apiRequest<PurchaseOrder>(
							`/purchase-order/${po.id}/status`,
							{ method: "PATCH", body: { status: "Printed" } },
						);
						onOrderUpdate(updated);
					} catch (err) { console.error("Failed to update PO status after PDF export:", err); }
				}
			} catch (err: unknown) {
				console.error("PDF export error:", err);
			} finally {
				setIsDetailPdfExporting(false);
			}
		},
		[detailData, po, editedRows, principals, onOrderUpdate],
	);

	// Filtered rows by category
	const filteredDetailRows = useMemo(() => {
		if (!detailData) return [] as Record<string, unknown>[];
		const rows = detailData.csvData.rows.map((r, i) => {
			const id = i + 1;
			return { ...(editedRows[id] ?? r), id };
		}) as Record<string, unknown>[];
		if (detailCategories.length === 0) return rows;
		return rows.filter((row) => {
			const cat = row._category as string | undefined;
			return cat ? detailCategories.includes(cat) : true;
		});
	}, [detailData, detailCategories, editedRows]);

	return (
		<>
			<Dialog
				open={open}
				onClose={handleClose}
				maxWidth="xl"
				fullWidth
				slotProps={{ paper: { sx: { height: "90dvh" } } }}
			>
				<DialogContent
					sx={{
						p: 0,
						display: "flex",
						flexDirection: "column",
						overflow: "hidden",
					}}
				>
					{detailLoading ? (
						<Box sx={{ display: "flex", flexDirection: "column", flex: 1 }}>
							<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
								<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 2, py: 1 }}>
									<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
										<Skeleton variant="text" width={200} height={32} />
										<Skeleton variant="rounded" width={110} height={32} sx={{ borderRadius: 2 }} />
									</Box>
									<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
										<Skeleton variant="rounded" width={70} height={28} />
										<Skeleton variant="rounded" width={70} height={28} />
										<Skeleton variant="rounded" width={60} height={28} />
										<Skeleton variant="rounded" width={60} height={28} />
										<Skeleton variant="circular" width={28} height={28} />
									</Box>
								</Box>
								<Box sx={{ px: 2, pb: 0.5 }}>
									<Skeleton variant="text" width={350} height={20} />
								</Box>
							</Box>
							<Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, px: 2, py: 1, alignItems: "center", borderBottom: "1px solid", borderColor: "divider" }}>
								<Skeleton variant="rounded" width={200} height={32} sx={{ borderRadius: 2 }} />
								<Skeleton variant="rounded" width={160} height={28} sx={{ borderRadius: 2, ml: "auto" }} />
							</Box>
							<Box sx={{ flex: 1, overflow: "auto" }}>
								<TableSkeleton animation="pulse" rowHeight={42} cols={[
									{ width: 110 }, { width: 260 }, { width: 90 }, { width: 110 },
									{ width: 110 }, { width: 150 }, { width: 180 }, { width: 130 },
								]} rows={8} />
							</Box>
						</Box>
					) : detailData && detailData.csvData.rows.length > 0 ? (
						<Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
							<DataGrid
								apiRef={detailApiRef}
								rows={filteredDetailRows}
								columns={detailColumns}
								getRowHeight={() => 42}
								getRowClassName={getRowClassName}
								editMode="row"
								processRowUpdate={handleProcessRowUpdate}
								onProcessRowUpdateError={handleProcessRowUpdateError}
								showToolbar
								slots={{ toolbar: DetailGridToolbar as React.ComponentType<any> }}
								slotProps={{
									toolbar: {
										selectedPo: po,
										detailCategories,
										onDetailCategoriesChange: setDetailCategories,
										getCategoryColor,
										showDetailDemand,
										onToggleDetailDemand: handleToggleDetailDemand,
										onExcelExport: handleDetailExcelExport,
										onPdfExport: openDetailPdfDialog,
										onClose: handleClose,
										onStatusChange: handleStatusChange,
										isDetailPdfExporting,
									} as any,
									pagination: { labelRowsPerPage: "Rows:" },
								}}
								initialState={{
									pagination: { paginationModel: { pageSize: 20 } },
									sorting: { sortModel: [{ field: "_category", sort: "asc" }] },
								}}
								pageSizeOptions={[10, 20, 50]}
								checkboxSelection
								disableRowSelectionOnClick
								sx={gridSx}
							/>
						</Box>
					) : detailData ? (
						<Box sx={{ p: 4, textAlign: "center" }}>
							<Typography color="text.secondary">No grid data found in this purchase order.</Typography>
						</Box>
					) : (
						<Box sx={{ p: 4, textAlign: "center" }}>
							<Typography color="text.secondary">Failed to load purchase order data.</Typography>
							{error && <Typography variant="caption" color="error">{error}</Typography>}
						</Box>
					)}
				</DialogContent>
			</Dialog>

			<PoPdfExportDialog
				key={`pdf-dialog-${pdfDetailOpen}`}
				open={pdfDetailOpen}
				onClose={closeDetailPdfDialog}
				onExport={handleDetailPdfExport}
				initialValues={{
					poReference: po?.ref_num ?? "",
					preparedBy: po?.last_update_by || po?.created_by || "",
				}}
				logoOptions={LOGO_OPTIONS}
				isExporting={isDetailPdfExporting}
			/>
		</>
	);
};

export default DetailDialog;
