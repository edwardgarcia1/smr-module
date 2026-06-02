/**
 * PurchaseOrders Page — Lists saved purchase order snapshots from the
 * Requirements purchasing grid. Click a row to view the saved CSV data
 * in a DataGrid.
 */
import React, { useEffect, useState, useCallback } from "react";
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
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import apiRequest from "../services/api";

// ─── Types ────────────────────────────────────────────────────────────

interface PurchaseOrder {
	id: number;
	ref_num: string;
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

	// ─── Build detail grid columns from CSV headers ──────────────

	const detailColumns = React.useMemo<GridColDef[]>(() => {
		if (!detailData) return [];
		return detailData.csvData.headers.map((header) => ({
			field: header,
			headerName: header,
			width: 130,
			flex: header === "descr" ? 1 : undefined,
		}));
	}, [detailData]);

	// ─── Head cells for the list table ───────────────────────────

	const headCells: { id: OrderBy; label: string }[] = [
		{ id: "id", label: "ID" },
		{ id: "ref_num", label: "Ref Nbr" },
		{ id: "site_id", label: "Site" },
		{ id: "demand_mode", label: "Demand Mode" },
		{ id: "frequency", label: "Frequency" },
		{ id: "sales_from", label: "Sales From" },
		{ id: "sales_to", label: "Sales To" },
		{ id: "created_at", label: "Created" },
	];

	// ─── Render ─────────────────────────────────────────────────

	return (
		<>
			{error && (
				<Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			)}

			<Paper sx={{ width: "100%", mb: 2 }}>
				<Box
					sx={{
						px: 2,
						py: 1.5,
						borderBottom: 1,
						borderColor: "divider",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
						Saved Purchase Orders
					</Typography>
					{!loading && (
						<Typography variant="body2" color="text.secondary">
							{orders.length} record{orders.length !== 1 ? "s" : ""}
						</Typography>
					)}
				</Box>

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
							<Table stickyHeader aria-label="purchase orders list">
								<TableHead>
									<TableRow>
										{headCells.map((hc) => (
											<TableCell
												key={hc.id}
												sortDirection={orderBy === hc.id ? order : false}
												sx={{
													bgcolor: "var(--sidebar-bg)",
													color: "var(--sidebar-text)",
												}}
											>
												<TableSortLabel
													active={orderBy === hc.id}
													direction={orderBy === hc.id ? order : "asc"}
													onClick={() => handleRequestSort(hc.id)}
													sx={{
														"&.MuiTableSortLabel-active": {
															color: "var(--sidebar-text) !important",
														},
														"& .MuiTableSortLabel-icon": {
															color: "var(--sidebar-text) !important",
														},
														color: "var(--sidebar-text)",
													}}
												>
													{hc.label}
												</TableSortLabel>
											</TableCell>
										))}
										<TableCell
											sx={{
												bgcolor: "var(--sidebar-bg)",
												color: "var(--sidebar-text)",
											}}
										>
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
											<TableCell>{po.id}</TableCell>
											<TableCell sx={{ fontWeight: 600 }}>
												{po.ref_num}
											</TableCell>
											<TableCell>{po.site_id}</TableCell>
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
								Site: {selectedPo.site_id} ·{" "}
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
								initialState={{
									pagination: { paginationModel: { pageSize: 20 } },
								}}
								pageSizeOptions={[10, 20, 50]}
								checkboxSelection
								disableRowSelectionOnClick
								sx={{
									"& .MuiDataGrid-cell:focus": {
										outline: "none",
									},
									"& .MuiDataGrid-columnHeader:focus": {
										outline: "none",
									},
								}}
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
