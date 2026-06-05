/**
 * PrincipalsTab — Min stock principals table with inline editing.
 *
 * State management, search filtering, and pagination are delegated to
 * the shared useMinStockTab hook.
 */
import React, { useState } from "react";
import {
	Box,
	Typography,
	TextField,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TablePagination,
	InputAdornment,
	IconButton,
	CircularProgress,
	Alert,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import apiRequest from "../../services/api";
import type { PrincipalWithMinStockDetails } from "../../config/minStock";
import { useMinStockTab } from "../../hooks/useMinStockTab";
import InlineEditCell from "./InlineEditCell";

const PrincipalsTab: React.FC = () => {
	// Inline editing state (tab-specific)
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");
	const [saving, setSaving] = useState(false);

	// Shared state & logic via hook
	const {
		rows,
		setRows,
		loading,
		error,
		setError,
		searchQuery,
		page,
		setPage,
		rowsPerPage,
		setRowsPerPage,
		filteredRows,
		paginatedRows,
		handleSearchChange,
	} = useMinStockTab<PrincipalWithMinStockDetails>({
		url: "/min-stock/principals-details",
		searchFields: ["ClassID", "Descr"],
		sortField: "ClassID",
	});

	const handleEditOpen = (row: PrincipalWithMinStockDetails) => {
		setEditingId(row.ClassID);
		setEditValue(String(row.minStock));
	};

	const handleEditSave = async () => {
		if (!editingId) return;
		const val = parseFloat(editValue);
		if (isNaN(val) || val < 0) {
			setError("Min stock must be a valid non-negative number");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const row = rows.find((r) => r.ClassID === editingId);
			if (!row) return;

			if (row.minStockId) {
				await apiRequest(`/min-stock/principals/${row.minStockId}`, {
					method: "PUT",
					body: { min_stock: val },
				});
			} else {
				const created = await apiRequest<{ id: number }>(
					"/min-stock/principals",
					{
						method: "POST",
						body: { class_id: editingId, min_stock: val },
					},
				);
				setRows((prev) =>
					prev.map((r) =>
						r.ClassID === editingId
							? { ...r, minStock: val, minStockId: created.id }
							: r,
					),
				);
			}

			setRows((prev) =>
				prev.map((r) =>
					r.ClassID === editingId ? { ...r, minStock: val } : r,
				),
			);
			setEditingId(null);
		} catch (err: unknown) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to update principal min stock",
			);
		} finally {
			setSaving(false);
		}
	};

	const handleEditCancel = () => {
		setEditingId(null);
	};

	return (
		<>
			{error && (
				<Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			)}

			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					mb: 2,
					gap: 2,
					flexWrap: "wrap",
				}}
			>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					<TextField
						size="small"
						placeholder="Search class ID or description..."
						value={searchQuery}
						onChange={(e) => handleSearchChange(e.target.value)}
						slotProps={{
							input: {
								startAdornment: (
									<InputAdornment position="start">
										<SearchIcon />
									</InputAdornment>
								),
							},
						}}
						sx={{
							"& .MuiOutlinedInput-root": { borderRadius: 2, height: 36 },
							"& .MuiInputBase-input": { paddingY: 0 },
							minWidth: 280,
						}}
					/>
					<Typography variant="caption" sx={{ color: "text.secondary" }}>
						{filteredRows.length} principal
						{filteredRows.length !== 1 ? "s" : ""}
					</Typography>
				</Box>
			</Box>

			<TableContainer>
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell sx={{ fontWeight: 600 }}>Class ID</TableCell>
							<TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
							<TableCell sx={{ fontWeight: 600 }}>Vendor</TableCell>
							<TableCell sx={{ fontWeight: 600 }} align="right">
								Min Stock
							</TableCell>
							<TableCell
								sx={{ fontWeight: 600, width: 120 }}
								align="right"
							>
								Actions
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{loading ? (
							<TableRow>
								<TableCell colSpan={5} align="center" sx={{ py: 4 }}>
									<CircularProgress size={24} />
								</TableCell>
							</TableRow>
						) : paginatedRows.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={5}
									align="center"
									sx={{ py: 4, color: "text.secondary" }}
								>
									{searchQuery
										? "No principals match your search."
										: "No principals found."}
								</TableCell>
							</TableRow>
						) : (
							paginatedRows.map((row) => (
								<TableRow key={row.ClassID} hover>
									<TableCell sx={{ fontWeight: 600 }}>
										{row.ClassID}
									</TableCell>
									<TableCell
										sx={{
											maxWidth: 300,
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
									>
										{row.Descr}
									</TableCell>
									<TableCell>{row.VendId}</TableCell>
									<TableCell align="right">
										<InlineEditCell
											editing={editingId === row.ClassID}
											editValue={editValue}
											onEditChange={setEditValue}
											onSave={handleEditSave}
											onCancel={handleEditCancel}
											saving={saving}
											displayValue={row.minStock.toLocaleString(undefined, {
												minimumFractionDigits: 2,
												maximumFractionDigits: 4,
											})}
											step="0.1"
											inputWidth={80}
										/>
									</TableCell>
									<TableCell align="right">
										<IconButton
											size="small"
											onClick={() => handleEditOpen(row)}
											disabled={!!editingId}
										>
											<EditIcon fontSize="small" />
										</IconButton>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</TableContainer>

			<TablePagination
				component="div"
				count={filteredRows.length}
				page={page}
				onPageChange={(_, newPage) => setPage(newPage)}
				rowsPerPage={rowsPerPage}
				onRowsPerPageChange={(e) => {
					setRowsPerPage(parseInt(e.target.value, 10));
					setPage(0);
				}}
				rowsPerPageOptions={[10, 25, 50]}
				labelRowsPerPage="Rows:"
			/>
		</>
	);
};

export default PrincipalsTab;
