/**
 * PurchaseOrderListTable — Sortable table of purchase order summaries with
 * inline status select, view, and delete actions.
 */
import React from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TablePagination,
	TableSortLabel,
	Box,
	IconButton,
	Tooltip,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteIcon from "@mui/icons-material/Delete";
import StatusChipSelect from "./StatusChipSelect";
import {
	type PurchaseOrder,
	type Order,
	type OrderBy,
	type PoStatus,
	LIST_HEAD_CELLS,
	PAGE_SIZE_OPTIONS,
	formatDate,
	formatDateTime,
	capitalize,
} from "../../config/purchaseOrders";

interface PurchaseOrderListTableProps {
	paginatedOrders: PurchaseOrder[];
	filteredCount: number;
	page: number;
	rowsPerPage: number;
	order: Order;
	orderBy: OrderBy;
	onSort: (property: OrderBy) => void;
	onPageChange: (page: number) => void;
	onRowsPerPageChange: (rowsPerPage: number) => void;
	onOpenDetail: (po: PurchaseOrder) => void;
	onDelete: (id: number) => void;
	onStatusChange: (poId: number, newStatus: PoStatus) => void;
}

const PurchaseOrderListTable: React.FC<PurchaseOrderListTableProps> = ({
	paginatedOrders,
	filteredCount,
	page,
	rowsPerPage,
	order,
	orderBy,
	onSort,
	onPageChange,
	onRowsPerPageChange,
	onOpenDetail,
	onDelete,
	onStatusChange,
}) => (
	<>
		<TableContainer sx={{ flex: 1, overflow: "auto" }}>
			<Table size="small">
				<TableHead>
					<TableRow>
						{LIST_HEAD_CELLS.map((hc) => (
							<TableCell
								key={hc.id}
								sortDirection={orderBy === hc.id ? order : false}
								sx={{ fontWeight: 600 }}
							>
								<TableSortLabel
									active={orderBy === hc.id}
									direction={orderBy === hc.id ? order : "asc"}
									onClick={() => onSort(hc.id)}
								>
									{hc.label}
								</TableSortLabel>
							</TableCell>
						))}
						<TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{paginatedOrders.map((po) => (
						<TableRow
							key={po.id}
							hover
							sx={{ cursor: "pointer" }}
							onClick={() => onOpenDetail(po)}
						>
							<TableCell sx={{ fontWeight: 600 }}>
								{po.ref_num}
							</TableCell>
							<TableCell>{po.principal_id}</TableCell>
							<TableCell>
								{po.site_id && po.site_id.trim()
									? po.site_id
									: "ALL SITES"}
							</TableCell>
							<TableCell>
								{capitalize(po.demand_mode)}
							</TableCell>
							<TableCell>
								{capitalize(po.frequency)}
							</TableCell>
							<TableCell
								sx={{ p: 0.5, minWidth: 130 }}
								onClick={(e) => e.stopPropagation()}
							>
								<StatusChipSelect
									value={po.status}
									onChange={(newStatus) => onStatusChange(po.id, newStatus)}
									sx={{
										"& .MuiOutlinedInput-notchedOutline": { border: "none" },
										"& .MuiSelect-select": { py: 0.75 },
									}}
								/>
							</TableCell>
							<TableCell>{po.created_by || "—"}</TableCell>
							<TableCell>
								{po.last_update_at ? formatDate(po.last_update_at) : "—"}
							</TableCell>
							<TableCell>{po.last_update_by || "—"}</TableCell>
							<TableCell>{formatDateTime(po.created_at)}</TableCell>
							<TableCell>
								<Box
									sx={{ display: "flex", gap: 0.5 }}
									onClick={(e) => e.stopPropagation()}
								>
									<Tooltip title="View details">
										<IconButton
											size="small"
											onClick={() => onOpenDetail(po)}
										>
											<VisibilityIcon fontSize="small" />
										</IconButton>
									</Tooltip>
									<Tooltip title="Delete">
										<IconButton
											size="small"
											color="error"
											onClick={() => onDelete(po.id)}
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
			count={filteredCount}
			rowsPerPage={rowsPerPage}
			page={page}
			onPageChange={(_, newPage) => onPageChange(newPage)}
			onRowsPerPageChange={(e) =>
				onRowsPerPageChange(parseInt(e.target.value, 10))
			}
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
);

export default PurchaseOrderListTable;
