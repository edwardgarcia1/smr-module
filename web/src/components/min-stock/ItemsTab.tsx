/**
 * ItemsTab — Per-item min stock table with dialog-based editing for
 * both the setting type and the min stock value.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
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
	Chip,
	Alert,
	Autocomplete,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Select,
	MenuItem,
	FormControl,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import EditIcon from "@mui/icons-material/Edit";
import apiRequest from "../../services/api";
import {
	type ItemWithMinStockDetails,
	type ItemSetting,
	SETTING_OPTIONS,
	SETTING_COLORS,
} from "../../config/minStock";

const ItemsTab: React.FC = () => {
	const [rows, setRows] = useState<ItemWithMinStockDetails[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);

	// Dialog state
	const [dialogRow, setDialogRow] =
		useState<ItemWithMinStockDetails | null>(null);
	const [dialogSetting, setDialogSetting] = useState<ItemSetting>("Default");
	const [dialogValue, setDialogValue] = useState("");
	const [saving, setSaving] = useState(false);
	const [dialogError, setDialogError] = useState<string | null>(null);

	// Filter state
	const [settingFilter, setSettingFilter] = useState<ItemSetting[]>([]);
	const [classIdFilter, setClassIdFilter] = useState<string[]>([]);
	const classIdOptions = useMemo(
		() => [...new Set(rows.map((r) => r.ClassID))].sort(),
		[rows],
	);
	const hasActiveFilters =
		settingFilter.length > 0 || classIdFilter.length > 0;

	const fetchData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await apiRequest<ItemWithMinStockDetails[]>(
				"/min-stock/items-details",
			);
			data.sort((a, b) => a.InvtID.localeCompare(b.InvtID));
			setRows(data);
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : "Failed to fetch items",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const filteredRows = useMemo(() => {
		return rows.filter((r) => {
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase().trim();
				if (
					!r.InvtID.toLowerCase().includes(q) &&
					!r.ClassID.toLowerCase().includes(q) &&
					!r.Descr.toLowerCase().includes(q)
				)
					return false;
			}
			if (settingFilter.length > 0 && !settingFilter.includes(r.setting))
				return false;
			if (classIdFilter.length > 0 && !classIdFilter.includes(r.ClassID))
				return false;
			return true;
		});
	}, [rows, searchQuery, settingFilter, classIdFilter]);

	const paginatedRows = useMemo(
		() =>
			filteredRows.slice(
				page * rowsPerPage,
				page * rowsPerPage + rowsPerPage,
			),
		[filteredRows, page, rowsPerPage],
	);

	// ── Dialog handlers ───────────────────────────────────────────
	const handleEditOpen = (row: ItemWithMinStockDetails) => {
		setDialogRow(row);
		setDialogSetting(row.setting);
		setDialogValue(String(row.minStock));
		setDialogError(null);
	};

	const handleEditClose = () => {
		if (saving) return;
		setDialogRow(null);
		setDialogError(null);
	};

	const handleSave = async () => {
		if (!dialogRow) return;
		const val = parseFloat(dialogValue);
		if (isNaN(val) || val < 0) {
			setDialogError("Min stock must be a valid non-negative number");
			return;
		}
		setSaving(true);
		setDialogError(null);
		try {
			const { InvtID } = dialogRow;
			await apiRequest(`/min-stock/settings/${InvtID}`, {
				method: "PATCH",
				body: { min_stock_setting: dialogSetting },
			});

			if (dialogSetting === "Custom") {
				if (dialogRow.minStockItemId) {
					await apiRequest(
						`/min-stock/items/${dialogRow.minStockItemId}`,
						{
							method: "PUT",
							body: { min_stock: val },
						},
					);
				} else {
					const created = await apiRequest<{ id: number }>(
						"/min-stock/items",
						{
							method: "POST",
							body: { inventory_id: InvtID, min_stock: val },
						},
					);
					setRows((prev) =>
						prev.map((r) =>
							r.InvtID === InvtID
								? { ...r, minStockItemId: created.id }
								: r,
						),
					);
				}
			}

			setDialogRow(null);
			await fetchData();
		} catch (err: unknown) {
			setDialogError(
				err instanceof Error
					? err.message
					: "Failed to save item settings",
			);
		} finally {
			setSaving(false);
		}
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
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						gap: 1.5,
						flexWrap: "wrap",
						flex: 1,
					}}
				>
					<TextField
						size="small"
						placeholder="Search inventory ID, class ID, or description..."
						value={searchQuery}
						onChange={(e) => {
							setSearchQuery(e.target.value);
							setPage(0);
						}}
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
							minWidth: 220,
						}}
					/>

					{/* Setting filter */}
					<Autocomplete
						multiple
						size="small"
						options={SETTING_OPTIONS}
						value={settingFilter}
						onChange={(_, newVal) => {
							setSettingFilter(newVal as ItemSetting[]);
							setPage(0);
						}}
						renderInput={(params) => (
							<TextField
								{...params}
								placeholder="Setting"
								sx={{
									"& .MuiOutlinedInput-root": {
										borderRadius: 2,
										height: 36,
									},
									minWidth: 140,
								}}
							/>
						)}
						renderValue={(value, getItemProps) =>
							(value as ItemSetting[]).map((option, index) => {
								const chipProps = getItemProps({ index });
								return (
									<Chip
										{...chipProps}
										label={option}
										size="small"
										color={SETTING_COLORS[option] ?? "default"}
										variant="outlined"
										sx={{ height: 20, fontSize: "0.7rem" }}
									/>
								);
							})
						}
						sx={{ minWidth: 140 }}
					/>

					{/* Class ID filter */}
					<Autocomplete
						multiple
						size="small"
						options={classIdOptions}
						value={classIdFilter}
						onChange={(_, newVal) => {
							setClassIdFilter(newVal);
							setPage(0);
						}}
						renderInput={(params) => (
							<TextField
								{...params}
								placeholder="Class ID"
								sx={{
									"& .MuiOutlinedInput-root": {
										borderRadius: 2,
										height: 36,
									},
									minWidth: 140,
								}}
							/>
						)}
						renderValue={(value, getItemProps) =>
							(value as string[]).map((option, index) => {
								const chipProps = getItemProps({ index });
								return (
									<Chip
										{...chipProps}
										label={option}
										size="small"
										variant="outlined"
										sx={{ height: 20, fontSize: "0.7rem" }}
									/>
								);
							})
						}
						sx={{ minWidth: 140 }}
					/>

					{hasActiveFilters && (
						<IconButton
							size="small"
							onClick={() => {
								setSettingFilter([]);
								setClassIdFilter([]);
								setSearchQuery("");
								setPage(0);
							}}
							sx={{ borderRadius: 2 }}
							title="Clear all filters"
						>
							<FilterListIcon fontSize="small" />
						</IconButton>
					)}

					<Typography variant="caption" sx={{ color: "text.secondary" }}>
						{filteredRows.length} item
						{filteredRows.length !== 1 ? "s" : ""}
					</Typography>
				</Box>
			</Box>

			<TableContainer>
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell sx={{ fontWeight: 600 }}>Invt ID</TableCell>
							<TableCell sx={{ fontWeight: 600 }}>Class ID</TableCell>
							<TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
							<TableCell sx={{ fontWeight: 600 }}>Setting</TableCell>
							<TableCell sx={{ fontWeight: 600 }} align="right">
								Min Stock
							</TableCell>
							<TableCell
								sx={{ fontWeight: 600, width: 80 }}
								align="right"
							>
								Actions
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{loading ? (
							<TableRow>
								<TableCell colSpan={6} align="center" sx={{ py: 4 }}>
									<CircularProgress size={24} />
								</TableCell>
							</TableRow>
						) : paginatedRows.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={6}
									align="center"
									sx={{ py: 4, color: "text.secondary" }}
								>
									{searchQuery
										? "No items match your search."
										: "No items found."}
								</TableCell>
							</TableRow>
						) : (
							paginatedRows.map((row) => (
								<TableRow key={row.InvtID} hover>
									<TableCell sx={{ fontWeight: 600 }}>
										{row.InvtID}
									</TableCell>
									<TableCell>{row.ClassID}</TableCell>
									<TableCell
										sx={{
											maxWidth: 250,
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
									>
										{row.Descr}
									</TableCell>
									<TableCell>
										<Chip
											label={row.setting}
											size="small"
											color={SETTING_COLORS[row.setting] ?? "default"}
											variant="outlined"
											sx={{ fontSize: "0.7rem", height: 20 }}
										/>
									</TableCell>
									<TableCell align="right">
										<Typography
											variant="body2"
											sx={{ fontVariantNumeric: "tabular-nums" }}
										>
											{row.minStock.toLocaleString(undefined, {
												minimumFractionDigits: 2,
												maximumFractionDigits: 4,
											})}
										</Typography>
									</TableCell>
									<TableCell align="right">
										<IconButton
											size="small"
											onClick={() => handleEditOpen(row)}
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

			{/* Edit Dialog */}
			<Dialog
				open={dialogRow != null}
				onClose={handleEditClose}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>
					Edit Min Stock — {dialogRow?.InvtID}
				</DialogTitle>
				<DialogContent>
					<Box
						sx={{
							display: "flex",
							flexDirection: "column",
							gap: 2,
							mt: 1,
						}}
					>
						{dialogError && (
							<Alert
								severity="error"
								onClose={() => setDialogError(null)}
							>
								{dialogError}
							</Alert>
						)}
						<Box>
							<Typography
								variant="caption"
								sx={{
									fontWeight: 600,
									mb: 0.5,
									display: "block",
								}}
							>
								Min Stock Setting
							</Typography>
							<FormControl fullWidth size="small">
								<Select
									value={dialogSetting}
									onChange={(e) =>
										setDialogSetting(
											e.target.value as ItemSetting,
										)
									}
									disabled={saving}
								>
									{SETTING_OPTIONS.map((opt) => (
										<MenuItem key={opt} value={opt}>
											{opt}
										</MenuItem>
									))}
								</Select>
							</FormControl>
						</Box>
						<TextField
							label={
								dialogSetting === "Custom"
									? "Min Stock (Custom)"
									: dialogSetting === "Principal"
										? "Min Stock (from Principal)"
										: "Min Stock (from Default)"
							}
							type="number"
							value={dialogValue}
							onChange={(e) => setDialogValue(e.target.value)}
							size="small"
							slotProps={{
								htmlInput: { step: "0.1", min: 0 },
							}}
							disabled={dialogSetting !== "Custom" || saving}
							helperText={
								dialogSetting !== "Custom"
									? "Switch to Custom to edit this value"
									: undefined
							}
						/>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleEditClose} disabled={saving}>
						Cancel
					</Button>
					<Button
						variant="contained"
						onClick={handleSave}
						disabled={saving}
					>
						{saving ? "Saving..." : "Save"}
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
};

export default ItemsTab;
