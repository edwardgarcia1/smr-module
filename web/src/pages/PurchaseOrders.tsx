/**
 * PurchaseOrders Page — Lists saved purchase order snapshots from the
 * Requirements purchasing grid. Click a row to view the saved CSV data
 * in a DataGrid.
 */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
	Box,
	Paper,
	Alert,
	Typography,
} from "@mui/material";
import apiRequest from "../services/api";
import TableSkeleton from "../components/TableSkeleton";
import type {
	MinStockCategory,
	Principal,
} from "../config/requirements";
import PurchaseOrderFilters from "../components/purchase-orders/PurchaseOrderFilters";
import PurchaseOrderListTable from "../components/purchase-orders/PurchaseOrderListTable";
import DetailDialog from "../components/purchase-orders/DetailDialog";
import type {
	PurchaseOrder,
	Order,
	OrderBy,
	PoStatus,
} from "../config/purchaseOrders";
import { ALLOWED_SITE_IDS } from "../config/requirements";

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
	const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);

	const [categories, setCategories] = useState<MinStockCategory[]>([]);
	const [principals, setPrincipals] = useState<Principal[]>([]);
	const [storageLocations, setStorageLocations] = useState<
		{ id: string; name: string }[]
	>([]);

	useEffect(() => {
		let cancelled = false;
		apiRequest<{
			sites: { SiteId: string; Name: string }[];
			principals: Principal[];
			minStockCategories: MinStockCategory[];
		}>("/lookups")
			.then((data) => {
				if (!cancelled && data) {
					setCategories(data.minStockCategories ?? []);
					setPrincipals(data.principals ?? []);
					setStorageLocations(
						(data.sites ?? [])
							.filter((s) => ALLOWED_SITE_IDS.has(s.SiteId))
							.map((s) => ({ id: s.SiteId, name: s.Name })),
					);
				}
			})
			.catch(() => { /* non-critical */ });
		return () => { cancelled = true; };
	}, []);

	// ─── List filters ────────────────────────────────────────────

	const [filterPrincipals, setFilterPrincipals] = useState<Principal[]>([]);
	const [filterSites, setFilterSites] = useState<{ id: string; name: string }[]>([]);
	const [searchRef, setSearchRef] = useState("");
	const [filterDemandModes, setFilterDemandModes] = useState<string[]>([]);
	const [filterFrequencies, setFilterFrequencies] = useState<string[]>([]);
	const [filterStatuses, setFilterStatuses] = useState<PoStatus[]>([]);

	const siteFilterOptions = useMemo(
		() => [{ id: "ALL_SITES", name: "All Sites" }, ...storageLocations],
		[storageLocations],
	);

	const filteredOrders = useMemo(() => {
		return orders.filter((po) => {
			if (filterPrincipals.length > 0 && !filterPrincipals.some((p) => p.ClassID === po.principal_id))
				return false;
			if (filterSites.length > 0) {
				const hasAllSites = filterSites.some((s) => s.id === "ALL_SITES");
				const poSiteIds = (po.site_id ?? "").split(",").map((s) => s.trim()).filter(Boolean);
				if (poSiteIds.length === 0) { if (!hasAllSites) return false; }
				else { if (!poSiteIds.some((id) => filterSites.some((fs) => fs.id === id))) return false; }
			}
			if (searchRef.trim()) {
				const q = searchRef.trim().toLowerCase();
				if (!po.ref_num.toLowerCase().includes(q)) return false;
			}
			if (filterDemandModes.length > 0 && !filterDemandModes.includes(po.demand_mode)) return false;
			if (filterFrequencies.length > 0 && !filterFrequencies.includes(po.frequency)) return false;
			if (filterStatuses.length > 0 && !filterStatuses.includes(po.status)) return false;
			return true;
		});
	}, [orders, filterPrincipals, filterSites, searchRef, filterDemandModes, filterFrequencies, filterStatuses]);

	// ─── Fetch list ─────────────────────────────────────────────

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

	useEffect(() => { fetchOrders(); }, [fetchOrders]);

	// ─── Sort / Pagination handlers ─────────────────────────────

	const handleRequestSort = (property: OrderBy) => {
		const isAsc = orderBy === property && order === "asc";
		setOrder(isAsc ? "desc" : "asc");
		setOrderBy(property);
	};

	const handleChangePage = (newPage: number) => setPage(newPage);
	const handleChangeRowsPerPage = (newRowsPerPage: number) => {
		setRowsPerPage(newRowsPerPage);
		setPage(0);
	};

	// ─── Sort & paginate ────────────────────────────────────────

	const sortedOrders = [...filteredOrders].sort((a, b) => {
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

	// ─── Detail dialog handlers ─────────────────────────────────

	const handleOpenDetail = useCallback((po: PurchaseOrder) => {
		setSelectedPo(po);
		setDetailOpen(true);
	}, []);

	const handleCloseDetail = useCallback(() => {
		setDetailOpen(false);
		setSelectedPo(null);
	}, []);

	const handleOrderUpdate = useCallback((updated: PurchaseOrder) => {
		setOrders((prev) =>
			prev.map((o) => (o.id === updated.id ? updated : o)),
		);
	}, []);

	// ─── Delete ─────────────────────────────────────────────────

	const handleDelete = useCallback(async (id: number) => {
		if (!confirm("Delete this purchase order? This action cannot be undone.")) return;
		try {
			await apiRequest(`/purchase-order/${id}`, { method: "DELETE" });
			setOrders((prev) => prev.filter((o) => o.id !== id));
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to delete purchase order.");
		}
	}, []);

	// ─── List inline status change ─────────────────────────────

	const handleStatusChangeFromList = useCallback(
		async (poId: number, newStatus: PoStatus) => {
			try {
				const updated = await apiRequest<PurchaseOrder>(
					`/purchase-order/${poId}/status`,
					{ method: "PATCH", body: { status: newStatus } },
				);
				setOrders((prev) =>
					prev.map((o) =>
						o.id === poId ? { ...o, status: updated.status, status_from: updated.status_from, status_by: updated.status_by } : o,
					),
				);
			} catch (err) { console.error("Failed to update status:", err); }
		},
		[],
	);

	// ─── Render ─────────────────────────────────────────────────

	return (
		<Box
			sx={{
				height: "calc(100dvh - 130px)",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				width: "100%",
			}}
		>
			{error && (
				<Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			)}

			<Paper
				sx={{
					flex: 1,
					overflow: "hidden",
					display: "flex",
					flexDirection: "column",
					borderRadius: 2,
				}}
			>
				{/* Title bar */}
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						px: 2,
						pt: 1.5,
						pb: 1,
						borderBottom: "1px solid",
						borderColor: "divider",
					}}
				>
					<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
						Purchase Orders
					</Typography>
				</Box>

				{/* Filters */}
				<PurchaseOrderFilters
					searchRef={searchRef}
					onSearchChange={setSearchRef}
					principals={principals}
					filterPrincipals={filterPrincipals}
					onFilterPrincipalsChange={setFilterPrincipals}
					siteFilterOptions={siteFilterOptions}
					filterSites={filterSites}
					onFilterSitesChange={setFilterSites}
					filterDemandModes={filterDemandModes}
					onFilterDemandModesChange={setFilterDemandModes}
					filterFrequencies={filterFrequencies}
					onFilterFrequenciesChange={setFilterFrequencies}
					filterStatuses={filterStatuses}
					onFilterStatusesChange={setFilterStatuses}
				/>

				{/* Content */}
				{loading ? (
					<Box sx={{ flex: 1, overflow: "auto" }}>
						<TableSkeleton
							cols={[{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, { icon: true }]}
							rows={8}
						/>
					</Box>
				) : orders.length === 0 ? (
					<Box sx={{ p: 4, textAlign: "center" }}>
						<Typography color="text.secondary">
							No saved purchase orders yet. Generate requirements and use the
							"Save" button on the Requirements page to create one.
						</Typography>
					</Box>
				) : filteredOrders.length === 0 ? (
					<Box sx={{ p: 4, textAlign: "center" }}>
						<Typography color="text.secondary">
							No purchase orders match the current filters.
						</Typography>
					</Box>
				) : (
					<PurchaseOrderListTable
						paginatedOrders={paginatedOrders}
						filteredCount={filteredOrders.length}
						page={page}
						rowsPerPage={rowsPerPage}
						order={order}
						orderBy={orderBy}
						onSort={handleRequestSort}
						onPageChange={handleChangePage}
						onRowsPerPageChange={handleChangeRowsPerPage}
						onOpenDetail={handleOpenDetail}
						onDelete={handleDelete}
						onStatusChange={handleStatusChangeFromList}
					/>
				)}
			</Paper>

			{/* Detail Dialog */}
			<DetailDialog
				open={detailOpen}
				onClose={handleCloseDetail}
				po={selectedPo}
				onOrderUpdate={handleOrderUpdate}
				categories={categories}
				principals={principals}
			/>
		</Box>
	);
};

export default PurchaseOrders;
