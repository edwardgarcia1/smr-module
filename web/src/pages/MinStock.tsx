import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
	Box,
	Paper,
	Typography,
	TextField,
	Button,
	IconButton,
	Alert,
	Select,
	MenuItem,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TablePagination,
	InputAdornment,
	Chip,
	CircularProgress,
	Tabs,
	Tab,
	Autocomplete,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import apiRequest from "../services/api";

// ─── Types matching backend merged responses ────────────────────────

interface PrincipalWithMinStockDetails {
	ClassID: string;
	Descr: string;
	User5: string;
	VendId: string;
	VendorAddr1: string;
	VendorAddr2: string;
	VendorCity: string;
	VendorTerms: string;
	minStock: number;
	minStockId: number | null;
}

interface ItemWithMinStockDetails {
	InvtID: string;
	ClassID: string;
	Descr: string;
	setting: "Custom" | "Principal" | "Default";
	minStock: number;
	minStockSettingId: number | null;
	minStockItemId: number | null;
}

// ─── Shared constants ────────────────────────────────────────────────

const SETTING_OPTIONS: ItemWithMinStockDetails["setting"][] = [
	"Custom",
	"Principal",
	"Default",
];

const SETTING_COLORS: Record<
	ItemWithMinStockDetails["setting"],
	"primary" | "warning" | "default"
> = {
	Custom: "primary",
	Principal: "warning",
	Default: "default",
};

// ─── MinStockCategory type ───────────────────────────────────────────

interface CategoryRow {
	id: number;
	category_name: string;
	threshold: number | null;
}

// ─── Shared inline edit cell ────────────────────────────────────────
// Used by CategoriesCard and PrincipalsTab for inline threshold editing.

interface InlineEditCellProps {
	editing: boolean;
	editValue: string;
	onEditChange: (value: string) => void;
	onSave: () => void;
	onCancel: () => void;
	saving: boolean;
	displayValue: string;
	step?: string;
	inputWidth?: number;
}

const InlineEditCell: React.FC<InlineEditCellProps> = ({
	editing,
	editValue,
	onEditChange,
	onSave,
	onCancel,
	saving,
	displayValue,
	step = "0.01",
	inputWidth = 70,
}) => {
	if (editing) {
		return (
			<Box
				sx={{
					display: "flex",
					gap: 0.5,
					alignItems: "center",
					justifyContent: "flex-end",
				}}
			>
				<TextField
					size="small"
					type="number"
					value={editValue}
					onChange={(e) => onEditChange(e.target.value)}
					slotProps={{
						htmlInput: {
							step,
							min: 0,
							style: { textAlign: "right", width: inputWidth },
						},
					}}
					sx={{ width: inputWidth + 20 }}
					disabled={saving}
					autoFocus
				/>
				<IconButton
					size="small"
					color="primary"
					onClick={onSave}
					disabled={saving}
				>
					<SaveIcon fontSize="small" />
				</IconButton>
				<IconButton
					size="small"
					onClick={onCancel}
					disabled={saving}
				>
					<CancelIcon fontSize="small" />
				</IconButton>
			</Box>
		);
	}
	return (
		<Typography
			variant="body2"
			sx={{ fontVariantNumeric: "tabular-nums" }}
		>
			{displayValue}
		</Typography>
	);
};

// ─── Categories Threshold Card ─────────────────────────────────────

const CategoriesCard: React.FC = () => {
	const [categories, setCategories] = useState<CategoryRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Inline editing state
	const [editingId, setEditingId] = useState<number | null>(null);
	const [editValue, setEditValue] = useState("");
	const [saving, setSaving] = useState(false);

	const fetchCategories = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await apiRequest<CategoryRow[]>("/min-stock/categories");
			// Sort into logical order: Immediate → Secondary → Monitoring → Overstocked
			const order = ["Immediate", "Secondary", "Monitoring", "Overstocked"];
			data.sort(
				(a, b) =>
					order.indexOf(a.category_name) - order.indexOf(b.category_name),
			);
			setCategories(data);
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : "Failed to fetch categories",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchCategories();
	}, [fetchCategories]);

	const handleEditOpen = (row: CategoryRow) => {
		setEditingId(row.id);
		setEditValue(row.threshold !== null ? String(row.threshold) : "");
	};

	const handleEditCancel = () => {
		setEditingId(null);
	};

	const handleEditSave = async () => {
		if (editingId === null) return;

		const val = editValue.trim() === "" ? null : parseFloat(editValue);
		if (val !== null && (isNaN(val) || val < 0)) {
			setError("Threshold must be a valid non-negative number");
			return;
		}

		setSaving(true);
		setError(null);
		try {
			await apiRequest(`/min-stock/categories/${editingId}`, {
				method: "PATCH",
				body: { threshold: val },
			});
			setCategories((prev) =>
				prev.map((c) =>
					c.id === editingId ? { ...c, threshold: val } : c,
				),
			);
			setEditingId(null);
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : "Failed to update category",
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Paper sx={{ mb: 3, borderRadius: 2, overflow: "hidden" }}>
			<Box
				sx={{
					px: 2.5,
					py: 1.5,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					borderBottom: 1,
					borderColor: "divider",
				}}
			>
				<Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
					Min Stock Categories
				</Typography>
				{error && (
					<Alert severity="error" sx={{ py: 0, flex: 1 }} onClose={() => setError(null)}>
						{error}
					</Alert>
				)}
			</Box>
			<Box sx={{ p: 0 }}>
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell sx={{ fontWeight: 600, width: 160 }}>
								Category
							</TableCell>
							<TableCell sx={{ fontWeight: 600 }}>
								Description
							</TableCell>
							<TableCell sx={{ fontWeight: 600 }} align="right">
								Threshold
							</TableCell>
							<TableCell sx={{ fontWeight: 600, width: 80 }} align="right">
								Actions
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{loading ? (
							<TableRow>
								<TableCell colSpan={4} align="center" sx={{ py: 2 }}>
									<CircularProgress size={20} />
								</TableCell>
							</TableRow>
						) : (
							categories.map((row) => {
								let description = "";
								if (row.category_name === "Immediate")
									description = "ratio < threshold";
								else if (row.category_name === "Overstocked")
									description = "ratio ≥ threshold (everything above monitoring threshold)";
								else description = "ratio < threshold";

								return (
									<TableRow key={row.id} hover>
										<TableCell sx={{ fontWeight: 600 }}>
											{row.category_name}
										</TableCell>
										<TableCell sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
											{description}
										</TableCell>
										<TableCell align="right">
											<InlineEditCell
												editing={editingId === row.id}
												editValue={editValue}
												onEditChange={setEditValue}
												onSave={handleEditSave}
												onCancel={handleEditCancel}
												saving={saving}
												displayValue={
													row.threshold !== null
														? row.threshold.toLocaleString(undefined, {
																minimumFractionDigits: 2,
																maximumFractionDigits: 2,
														  })
														: "—"
												}
												step="0.01"
												inputWidth={70}
											/>
										</TableCell>
										<TableCell align="right">
											{row.category_name === "Overstocked" ? (
												<Typography
													variant="caption"
													sx={{ color: "text.disabled", fontStyle: "italic" }}
												>
													Fixed
												</Typography>
											) : (
												<IconButton
													size="small"
													onClick={() => handleEditOpen(row)}
													disabled={editingId !== null}
												>
													<EditIcon fontSize="small" />
												</IconButton>
											)}
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</Box>
		</Paper>
	);
};

// ─── Tab Panel ───────────────────────────────────────────────────────

interface TabPanelProps {
	children: React.ReactNode;
	value: number;
	index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
	<Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
		{value === index && children}
	</Box>
);

// ─── Principals Tab ─────────────────────────────────────────────────

const PrincipalsTab: React.FC = () => {
	const [rows, setRows] = useState<PrincipalWithMinStockDetails[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);

	// Inline editing state
	const [editingId, setEditingId] = useState<string | null>(null); // ClassID being edited
	const [editValue, setEditValue] = useState("");
	const [saving, setSaving] = useState(false);

	const fetchData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await apiRequest<PrincipalWithMinStockDetails[]>(
				"/min-stock/principals-details",
			);
			// Sort by ClassID
			data.sort((a, b) => a.ClassID.localeCompare(b.ClassID));
			setRows(data);
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : "Failed to fetch principals",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const filteredRows = useMemo(() => {
		if (!searchQuery.trim()) return rows;
		const q = searchQuery.toLowerCase().trim();
		return rows.filter(
			(r) =>
				r.ClassID.toLowerCase().includes(q) ||
				r.Descr.toLowerCase().includes(q),
		);
	}, [rows, searchQuery]);

	const paginatedRows = useMemo(
		() =>
			filteredRows.slice(
				page * rowsPerPage,
				page * rowsPerPage + rowsPerPage,
			),
		[filteredRows, page, rowsPerPage],
	);

	// ── Inline Edit ──────────────────────────────────────────────
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
							<TableCell sx={{ fontWeight: 600, width: 120 }} align="right">
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
									<TableCell sx={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

// ─── Items Tab ──────────────────────────────────────────────────────

const ItemsTab: React.FC = () => {
	const [rows, setRows] = useState<ItemWithMinStockDetails[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);

	// Dialog state
	const [dialogRow, setDialogRow] = useState<ItemWithMinStockDetails | null>(
		null,
	);
	const [dialogSetting, setDialogSetting] =
		useState<ItemWithMinStockDetails["setting"]>("Default");
	const [dialogValue, setDialogValue] = useState("");
	const [saving, setSaving] = useState(false);
	const [dialogError, setDialogError] = useState<string | null>(null);

	// Filter state
	const [settingFilter, setSettingFilter] = useState<
		ItemWithMinStockDetails["setting"][]
	>([]);
	const [classIdFilter, setClassIdFilter] = useState<string[]>([]);

	// Derived: unique class IDs and setting options for Autocomplete
	const classIdOptions = useMemo(
		() => [...new Set(rows.map((r) => r.ClassID))].sort(),
		[rows],
	);

	const settingOptions: ItemWithMinStockDetails["setting"][] = [
		"Custom",
		"Principal",
		"Default",
	];

	const hasActiveFilters = settingFilter.length > 0 || classIdFilter.length > 0;

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
			// Text search
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase().trim();
				if (
					!r.InvtID.toLowerCase().includes(q) &&
					!r.ClassID.toLowerCase().includes(q) &&
					!r.Descr.toLowerCase().includes(q)
				)
					return false;
			}
			// Setting filter
			if (settingFilter.length > 0 && !settingFilter.includes(r.setting))
				return false;
			// Class ID filter
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

	// ── Dialog Open ────────────────────────────────────────────────
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

	// ── Dialog Save ───────────────────────────────────────────────
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

			// 1. Always update the setting
			await apiRequest(`/min-stock/settings/${InvtID}`, {
				method: "PATCH",
				body: { min_stock_setting: dialogSetting },
			});

			// 2. If Custom, persist the min stock value
			if (dialogSetting === "Custom") {
				if (dialogRow.minStockItemId) {
					await apiRequest(`/min-stock/items/${dialogRow.minStockItemId}`, {
						method: "PUT",
						body: { min_stock: val },
					});
				} else {
					const created = await apiRequest<{ id: number }>(
						"/min-stock/items",
						{
							method: "POST",
							body: { inventory_id: InvtID, min_stock: val },
						},
					);
					// Track new id so next edit works
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
				err instanceof Error ? err.message : "Failed to save item settings",
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

					<Autocomplete
						multiple
						size="small"
						options={settingOptions}
						value={settingFilter}
						onChange={(_, newVal) => {
							setSettingFilter(newVal);
							setPage(0);
						}}
						renderInput={(params) => (
							<TextField
								{...params}
								placeholder="Setting"
								sx={{
									"& .MuiOutlinedInput-root": { borderRadius: 2, height: 36 },
									minWidth: 140,
								}}
							/>
						)}
						renderValue={(value, getItemProps) =>
							(value as ItemWithMinStockDetails["setting"][]).map((option, index) => {
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
									"& .MuiOutlinedInput-root": { borderRadius: 2, height: 36 },
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
							<TableCell sx={{ fontWeight: 600, width: 80 }} align="right">
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

			{/* Edit Dialog — single dialog for both setting and min stock */}
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
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
						{dialogError && (
							<Alert severity="error" onClose={() => setDialogError(null)}>
								{dialogError}
							</Alert>
						)}
						<Box>
							<Typography
								variant="caption"
								sx={{ fontWeight: 600, mb: 0.5, display: "block" }}
							>
								Min Stock Setting
							</Typography>
							<Select
								size="small"
								value={dialogSetting}
								onChange={(e) =>
									setDialogSetting(
										e.target.value as ItemWithMinStockDetails["setting"],
									)
								}
								fullWidth
								disabled={saving}
							>
								{SETTING_OPTIONS.map((opt) => (
									<MenuItem key={opt} value={opt}>
										{opt}
									</MenuItem>
								))}
							</Select>
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

// ─── Main Component ─────────────────────────────────────────────────

const MinStock: React.FC = () => {
	const [tab, setTab] = useState(0);

	return (
		<>
			<CategoriesCard />
			<Paper sx={{ width: "100%", borderRadius: 2, overflow: "hidden" }}>
			<Tabs
				value={tab}
				onChange={(_, newVal) => setTab(newVal)}
				sx={{
					borderBottom: 1,
					borderColor: "divider",
					px: 2,
					"& .MuiTab-root": { textTransform: "none", fontWeight: 600 },
				}}
			>
				<Tab label="Principals (Class-Level)" />
				<Tab label="Items (Per-Item)" />
			</Tabs>

			<Box sx={{ p: 2 }}>
				<TabPanel value={tab} index={0}>
					<PrincipalsTab />
				</TabPanel>
				<TabPanel value={tab} index={1}>
					<ItemsTab />
				</TabPanel>
			</Box>
		</Paper>
		</>
	);
};

export default MinStock;
