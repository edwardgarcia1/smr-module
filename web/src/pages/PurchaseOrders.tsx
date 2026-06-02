/**
 * PurchaseOrders Page — Lists saved purchase order snapshots from the
 * Requirements purchasing grid. Click a row to view the saved CSV data
 * in a DataGrid.
 */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
	Box,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Paper,
	Alert,
	TablePagination,
	Typography,
	Button,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	IconButton,
	Tooltip,
	TableSortLabel,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import { DataGrid, type GridColDef, ColumnsPanelTrigger, FilterPanelTrigger } from "@mui/x-data-grid";
import apiRequest from "../services/api";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import FilterListIcon from "@mui/icons-material/FilterList";
import { useThemeMode } from "../providers/AppProvider";
import {
	buildGroupColors,
	computeCategoryName,
	periodSortValue,
	CATEGORY_CLASS_MAP,
	CATEGORY_ORDER,
} from "../config/requirements";
import type { MinStockCategory } from "../config/requirements";
import { buildBaseGridSx, purchasingGroupSelectors } from "../components/requirements/gridStyles";

// ─── Types ────────────────────────────────────────────────────────────

interface PurchaseOrder {
	id: number;
	ref_num: string;
	principal_id: string;
	site_id: string;
	demand_mode: string;
	frequency: string;
	sales_from: string;
	sales_to: string;
	csv_filename: string | null;
	created_at: string;
}

interface PurchaseOrderDetail {
	meta: PurchaseOrder;
	csvData: {
		headers: string[];
		rows: Record<string, string>[];
	};
}

type Order = "asc" | "desc";
type OrderBy = keyof PurchaseOrder;

const PAGE_SIZE_OPTIONS = [10, 20, 50];

// ─── Detail grid column width/label maps (matching RequirementsPage) ──

const DETAIL_COL_WIDTHS: Record<string, number> = {
	invtID: 110,
	descr: 260,
	stkUnit: 90,
	qtyPerCS: 90,
	price_ao: 150,
	price_perCS: 110,
	price_perStkUnit: 110,
	qtyOnHand: 110,
	qtyAvail: 110,
	qtyOnPO: 110,
	qtyAlloc: 110,
	avgDemand: 150,
	avgDemandCS: 120,
	totalDemandCS: 110,
	stockCoverCount: 130,
	coverageThreshold: 100,
	suggestedOrder: 180,
	suggestedOrderCS: 130,
	customOrder: 130,
	amount: 130,
	finalOrderCS: 130,
	orderCover: 130,
	incomingCover: 130,
	totalCover: 140,
	totalDemand: 110,
	_category: 130,
};

const DETAIL_HEADER_LABELS: Record<string, string> = {
	invtID: "Inventory ID",
	descr: "Description",
	stkUnit: "Stock Unit",
	qtyPerCS: "Qty/CS",
	price_ao: "Last Update",
	price_perCS: "Per CS",
	price_perStkUnit: "Per StkUnit",
	qtyOnHand: "On Hand",
	qtyAvail: "Available",
	qtyOnPO: "Incoming",
	qtyAlloc: "Unreleased",
	avgDemand: "Avg Demand",
	avgDemandCS: "Avg Demand (CS)",
	totalDemandCS: "Total (CS)",
	stockCoverCount: "Stock Cover",
	coverageThreshold: "Min Stock",
	suggestedOrder: "Suggested Order",
	suggestedOrderCS: "Suggested Order (CS)",
	customOrder: "Custom Order (CS)",
	amount: "Amount",
	finalOrderCS: "Final Order (CS)",
	orderCover: "Order Cover",
	incomingCover: "Incoming Cover",
	totalCover: "Total Cover",
	totalDemand: "Total",
	_category: "Category",
};

// ─── Column display order (matching RequirementsPage purchasing grid) ──
// pd_* (period demand) fields are interleaved after qtyAvail, sorted by name.

const DETAIL_COL_ORDER: string[] = [
	"invtID", "descr", "stkUnit", "qtyPerCS",
	"price_ao", "price_perCS", "price_perStkUnit",
	"qtyAlloc", "qtyOnPO", "qtyOnHand", "qtyAvail",
	"totalDemand", "totalDemandCS", "avgDemand", "avgDemandCS", "stockCoverCount",
	"coverageThreshold", "suggestedOrder", "suggestedOrderCS", "customOrder",
	"finalOrderCS",
	"orderCover", "incomingCover", "totalCover", "amount",
	"_category",
];

// Fields that are numeric — right-aligned with decimal formatting
const DETAIL_NUMERIC_FIELDS = new Set([
	"qtyPerCS", "price_perCS", "price_perStkUnit",
	"qtyOnHand", "qtyAvail", "qtyOnPO", "qtyAlloc",
	"totalDemand", "totalDemandCS", "avgDemand", "avgDemandCS",
	"stockCoverCount", "coverageThreshold",
	"suggestedOrder", "suggestedOrderCS", "customOrder", "amount",
	"finalOrderCS", "orderCover", "incomingCover", "totalCover",
]);

const formatDate = (dateStr: string): string => {
	if (!dateStr) return "—";
	try {
		return new Date(dateStr).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	} catch {
		return dateStr;
	}
};

const formatDateTime = (dateStr: string): string => {
	if (!dateStr) return "—";
	try {
		return new Date(dateStr).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return dateStr;
	}
};

// ─── Page Component ───────────────────────────────────────────────────

const PurchaseOrders: React.FC = () => {
	const [orders, setOrders] = useState<PurchaseOrder[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Pagination & sort
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);
	const [order, setOrder] = useState<Order>("desc");
	const [orderBy, setOrderBy] = useState<OrderBy>("created_at");

	// Detail dialog
	const [detailOpen, setDetailOpen] = useState(false);
	const [detailData, setDetailData] = useState<PurchaseOrderDetail | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);

	const { darkMode } = useThemeMode();
	const groupColors = useMemo(() => buildGroupColors(darkMode), [darkMode]);
	const gridSx = useMemo(
		() => buildBaseGridSx(darkMode, groupColors, purchasingGroupSelectors(groupColors)),
		[darkMode, groupColors],
	);

	const [categories, setCategories] = useState<MinStockCategory[]>([]);

	useEffect(() => {
		let cancelled = false;
		apiRequest<{ minStockCategories: MinStockCategory[] }>("/lookups")
			.then((data) => {
				if (!cancelled && data) {
					setCategories(data.minStockCategories ?? []);
				}
			})
			.catch(() => {
				/* non-critical */
			});
		return () => {
			cancelled = true;
		};
	}, []);

	// ─── Fetch list ───────────────────────────────────────────────

	const fetchOrders = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await apiRequest<PurchaseOrder[]>("/purchase-order");
			setOrders(data ?? []);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to load purchase orders.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchOrders();
	}, [fetchOrders]);

	// ─── Sort / Pagination handlers ──────────────────────────────

	const handleRequestSort = (property: OrderBy) => {
		const isAsc = orderBy === property && order === "asc";
		setOrder(isAsc ? "desc" : "asc");
		setOrderBy(property);
	};

	const handleChangePage = (_event: unknown, newPage: number) => {
		setPage(newPage);
	};

	const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
		setRowsPerPage(parseInt(event.target.value, 10));
		setPage(0);
	};

	// ─── Sort & paginate ─────────────────────────────────────────

	const sortedOrders = [...orders].sort((a, b) => {
		const aVal = a[orderBy];
		const bVal = b[orderBy];
		let comparison = 0;
		if (typeof aVal === "string" && typeof bVal === "string") {
			comparison = aVal.localeCompare(bVal);
		} else {
			comparison = (aVal as number) < (bVal as number) ? -1 : 1;
		}
		return order === "asc" ? comparison : -comparison;
	});

	const paginatedOrders = sortedOrders.slice(
		page * rowsPerPage,
		page * rowsPerPage + rowsPerPage,
	);

	// ─── Detail dialog ───────────────────────────────────────────

	const handleOpenDetail = useCallback(async (po: PurchaseOrder) => {
		setSelectedPo(po);
		setDetailLoading(true);
		setDetailOpen(true);
		try {
			const data = await apiRequest<PurchaseOrderDetail>(`/purchase-order/${po.id}`);
			setDetailData(data);
		} catch (err: unknown) {
			setDetailData(null);
			setError(err instanceof Error ? err.message : "Failed to load PO details.");
		} finally {
			setDetailLoading(false);
		}
	}, []);

	const handleCloseDetail = () => {
		setDetailOpen(false);
		setDetailData(null);
		setSelectedPo(null);
	};

	// ─── Delete ──────────────────────────────────────────────────

	const handleDelete = useCallback(async (id: number) => {
		if (!confirm("Delete this purchase order? This action cannot be undone.")) return;
		try {
			await apiRequest(`/purchase-order/${id}`, { method: "DELETE" });
			setOrders((prev) => prev.filter((o) => o.id !== id));
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to delete purchase order.");
		}
	}, []);

	// ─── Detail grid row class (category highlighting) ───────────
	// Uses the saved _category field from CSV (added at save time).
	// Falls back to computeCategoryName for legacy POs that lack _category.

	const getRowClassName = useCallback(
		(params: { row: Record<string, string> }) => {
			const r = params.row;
			// Direct lookup from saved _category field
			if (r._category && CATEGORY_CLASS_MAP[r._category]) {
				return CATEGORY_CLASS_MAP[r._category];
			}
			// Fallback: compute from raw fields for legacy POs
			const stockCoverCount = r.stockCoverCount ? Number(r.stockCoverCount) : null;
			const coverageThreshold = r.coverageThreshold ? Number(r.coverageThreshold) : null;
			const avgDemand = r.avgDemand ? Number(r.avgDemand) : null;
			const suggestedOrder = r.suggestedOrder ? Number(r.suggestedOrder) : null;
			const cat = computeCategoryName(
				{ stockCoverCount, coverageThreshold, avgDemand, suggestedOrder },
				categories,
			);
			return cat ? (CATEGORY_CLASS_MAP[cat] ?? "") : "";
		},
		[categories],
	);

	// ─── Build detail grid columns from CSV headers ──────────────

	const detailColumns = React.useMemo<GridColDef[]>(() => {
		if (!detailData) return [];

		const orderIdx: Record<string, number> = {};
		DETAIL_COL_ORDER.forEach((name, i) => {
			orderIdx[name] = i;
		});

		const sortedHeaders = [...detailData.csvData.headers].sort((a, b) => {
			const getKey = (h: string): number => {
				const idx = orderIdx[h];
				if (idx !== undefined) return idx;
				if (h.startsWith("pd_")) return 10.5; // between qtyAvail (10) and totalDemand (11)
				return 999; // unknown → end
			};
			const ka = getKey(a);
			const kb = getKey(b);
			if (ka !== kb) return ka - kb;
			// Both pd_* → chronological
			if (a.startsWith("pd_") && b.startsWith("pd_")) {
				return periodSortValue(a.slice(3)) - periodSortValue(b.slice(3));
			}
			// Both unknown → alphabetical
			if (ka === 999) return a.localeCompare(b);
			return 0;
		});

		return sortedHeaders.map((header) => {
			const isPeriodField = header.startsWith("pd_");
			const isNumeric = DETAIL_NUMERIC_FIELDS.has(header) || isPeriodField;
			const col: GridColDef = {
				field: header,
				headerName: DETAIL_HEADER_LABELS[header]
					?? (isPeriodField ? header.slice(3) : header),
				width: DETAIL_COL_WIDTHS[header] ?? (isPeriodField ? 110 : 130),
				flex: header === "descr" ? 1 : undefined,
			};
			// Numeric columns: right-aligned with decimal formatting
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
			// Format date fields like price_ao
			if (header === "price_ao") {
				col.valueFormatter = (value?: string) => {
					if (!value) return "—";
					try {
						return new Date(value).toLocaleDateString("en-US", {
							year: "numeric", month: "short", day: "numeric",
						});
					} catch {
						return value;
					}
				};
			}
			// Category sort: Immediate → Secondary → Monitoring → Ordered → Overstocked → No record
			if (header === "_category") {
				col.sortComparator = (v1: string | null, v2: string | null) => {
					const o1 = v1 ? (CATEGORY_ORDER[v1] ?? 99) : 99;
					const o2 = v2 ? (CATEGORY_ORDER[v2] ?? 99) : 99;
					return o1 - o2;
				};
			}
			return col;
		});
	}, [detailData]);

	// ─── Head cells for the list table ───────────────────────────

	const headCells: { id: OrderBy; label: string }[] = [
		{ id: "ref_num", label: "Ref Nbr" },
		{ id: "principal_id", label: "Principal" },
		{ id: "site_id", label: "Site(s)" },
		{ id: "demand_mode", label: "Demand Mode" },
		{ id: "frequency", label: "Frequency" },
		{ id: "sales_from", label: "Sales From" },
		{ id: "sales_to", label: "Sales To" },
		{ id: "created_at", label: "Created" },
	];

	// ─── Detail grid toolbar ────────────────────────────────────

	const DetailGridToolbar: React.FC = () => (
		<Box
			sx={{
				display: "flex",
				justifyContent: "space-between",
				alignItems: "center",
				px: 2,
				py: 1,
				borderBottom: "1px solid",
				borderColor: "divider",
			}}
		>
			<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
				{selectedPo?.ref_num ?? "Purchase Order Data"}
			</Typography>
			<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
				<ColumnsPanelTrigger
					size="small"
					color="primary"
					startIcon={<ViewColumnIcon />}
					sx={{
						minWidth: "auto",
						textTransform: "none",
						fontSize: "0.8125rem",
						fontWeight: 500,
						px: 0.75,
					}}
				>
					<Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
						Columns
					</Box>
				</ColumnsPanelTrigger>
				<FilterPanelTrigger
					size="small"
					color="primary"
					startIcon={<FilterListIcon />}
					sx={{
						minWidth: "auto",
						textTransform: "none",
						fontSize: "0.8125rem",
						fontWeight: 500,
						px: 0.75,
					}}
				>
					<Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
						Filters
					</Box>
				</FilterPanelTrigger>
			</Box>
		</Box>
	);

	// ─── Render ─────────────────────────────────────────────────

	return (
		<>
			{error && (
				<Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			)}

			<Paper sx={{ width: "100%", mb: 2, borderRadius: 2, overflow: "hidden" }}>
				{loading ? (
					<Box sx={{ p: 4, textAlign: "center" }}>
						<Typography color="text.secondary">Loading purchase orders…</Typography>
					</Box>
				) : orders.length === 0 ? (
					<Box sx={{ p: 4, textAlign: "center" }}>
						<Typography color="text.secondary">
							No saved purchase orders yet. Generate requirements and use the "Save" button
							on the Requirements page to create one.
						</Typography>
					</Box>
				) : (
					<>
						<TableContainer sx={{ maxHeight: 520 }}>
							<Table size="small">
									<TableHead>
									<TableRow>
										{headCells.map((hc) => (
											<TableCell
												key={hc.id}
												sortDirection={orderBy === hc.id ? order : false}
												sx={{ fontWeight: 600 }}
											>
												<TableSortLabel
													active={orderBy === hc.id}
													direction={orderBy === hc.id ? order : "asc"}
													onClick={() => handleRequestSort(hc.id)}
												>
													{hc.label}
												</TableSortLabel>
											</TableCell>
										))}
										<TableCell sx={{ fontWeight: 600 }}>
											Actions
										</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{paginatedOrders.map((po) => (
										<TableRow
											key={po.id}
											hover
											sx={{ cursor: "pointer" }}
											onClick={() => handleOpenDetail(po)}
										>
											<TableCell sx={{ fontWeight: 600 }}>
												{po.ref_num}
											</TableCell>
											<TableCell>{po.principal_id}</TableCell>
											<TableCell>
												{po.site_id && po.site_id.trim() ? po.site_id : "ALL SITES"}
											</TableCell>
											<TableCell>{po.demand_mode}</TableCell>
											<TableCell>{po.frequency}</TableCell>
											<TableCell>
												{formatDate(po.sales_from)}
											</TableCell>
											<TableCell>
												{formatDate(po.sales_to)}
											</TableCell>
											<TableCell>
												{formatDateTime(po.created_at)}
											</TableCell>
											<TableCell>
												<Box
													sx={{ display: "flex", gap: 0.5 }}
													onClick={(e) => e.stopPropagation()}
												>
													<Tooltip title="View details">
														<IconButton
															size="small"
															onClick={() => handleOpenDetail(po)}
														>
															<VisibilityIcon fontSize="small" />
														</IconButton>
													</Tooltip>
													<Tooltip title="Delete">
														<IconButton
															size="small"
															color="error"
															onClick={() => handleDelete(po.id)}
														>
															<DeleteIcon fontSize="small" />
														</IconButton>
													</Tooltip>
												</Box>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>
						<TablePagination
							component="div"
							count={orders.length}
							rowsPerPage={rowsPerPage}
							page={page}
							onPageChange={handleChangePage}
							onRowsPerPageChange={handleChangeRowsPerPage}
							labelRowsPerPage="Rows:"
							rowsPerPageOptions={PAGE_SIZE_OPTIONS}
							sx={{
								width: "100%",
								display: "flex",
								flexDirection: { xs: "column", sm: "row" },
								alignItems: "center",
								gap: 1,
								"& .MuiTablePagination-toolbar": {
									flexWrap: "wrap",
									justifyContent: { xs: "center", sm: "flex-end" },
								},
								"& .MuiTablePagination-spacer": {
									display: "none",
								},
							}}
						/>
					</>
				)}
			</Paper>

			{/* ── Detail Dialog ──────────────────────────────────────── */}
			<Dialog
				open={detailOpen}
				onClose={handleCloseDetail}
				maxWidth="xl"
				fullWidth
			>
				<DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					<Box sx={{ flex: 1 }}>
						{selectedPo ? selectedPo.ref_num : "Purchase Order"}
						{selectedPo && (
							<Typography variant="body2" color="text.secondary">
								{selectedPo.frequency} · {selectedPo.demand_mode} demand ·
								Principal: {selectedPo.principal_id} ·{" "}
								{formatDate(selectedPo.sales_from)} –{" "}
								{formatDate(selectedPo.sales_to)}
							</Typography>
						)}
					</Box>
					<IconButton onClick={handleCloseDetail} size="small">
						<CloseIcon />
					</IconButton>
				</DialogTitle>
				<DialogContent dividers>
					{detailLoading ? (
						<Box sx={{ p: 4, textAlign: "center" }}>
							<Typography color="text.secondary">
								Loading grid data…
							</Typography>
						</Box>
					) : detailData && detailData.csvData.rows.length > 0 ? (
						<Paper
							sx={{
								width: "100%",
								borderRadius: 2,
								overflow: "hidden",
								height: "calc(80dvh - 130px)",
							}}
						>
							<DataGrid
								rows={detailData.csvData.rows.map((r, i) => ({
									...r,
									id: i + 1,
								}))}
								columns={detailColumns}
								getRowHeight={() => 42}
								getRowClassName={getRowClassName}
								showToolbar
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
								slots={{ toolbar: DetailGridToolbar as React.ComponentType<any> }}
								slotProps={{ toolbar: {}, pagination: { labelRowsPerPage: "Rows:" } }}
								initialState={{
									pagination: { paginationModel: { pageSize: 20 } },
									sorting: { sortModel: [{ field: "_category", sort: "asc" }] },
								}}
								pageSizeOptions={[10, 20, 50]}
								checkboxSelection
								disableRowSelectionOnClick
								sx={gridSx}
							/>
						</Paper>
					) : detailData ? (
						<Box sx={{ p: 4, textAlign: "center" }}>
							<Typography color="text.secondary">
								No grid data found in this purchase order.
							</Typography>
						</Box>
					) : (
						<Box sx={{ p: 4, textAlign: "center" }}>
							<Typography color="text.secondary">
								Failed to load purchase order data.
							</Typography>
						</Box>
					)}
				</DialogContent>
				<DialogActions>
					<Button onClick={handleCloseDetail}>Close</Button>
				</DialogActions>
			</Dialog>
		</>
	);
};

export default PurchaseOrders;
