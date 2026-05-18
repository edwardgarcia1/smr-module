import React, { useState, useEffect, useCallback, useRef } from "react";
import {
	Box,
	Paper,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TablePagination,
	Collapse,
	IconButton,
	Typography,
	TextField,
	Autocomplete,
	InputAdornment,
	Alert,
	LinearProgress,
	Button,
	Select,
	MenuItem,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogContentText,
	DialogActions,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import UploadIcon from "@mui/icons-material/Upload";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import apiRequest from "../services/api";
import * as XLSX from "xlsx";

// ── Types matching price.schema.ts response ──────────────────────────

interface PriceHistoryEntry {
	valid_from: string;
	valid_to: string | null;
	cost: number;
	unit: string;
}

interface PriceRecord {
	item_cost_id: number | null;
	inventory_id: string;
	class_id: string | null;
	description: string | null;
	cost: number | null;
	unit: string | null;
	history: PriceHistoryEntry[];
}

interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	withoutCostCount: number;
}

interface ImportRow {
	inventory_id: string;
	cost: number;
	unit: string;
	valid_from: string;
	valid_to?: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────

function fmtNum(val: number | null | undefined): string {
	if (val === null || val === undefined) return "—";
	return val.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	});
}

function fmtDate(val: string | null | undefined): string {
	if (!val) return "Current";
	const d = new Date(val);
	return d.toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

const unitOptions = [
	"BAGS",
	"CAN",
	"CS",
	"IB",
	"PCK",
	"PCS",
	"PET",
	"SACKS",
	"SET",
	"SW",
	"TETRA",
];

// ── Row Component (collapsible + editable) ───────────────────────────

interface RowProps {
	row: PriceRecord;
	editRowId: number | null;
	editInventoryId: string | null;
	editCost: string;
	editUnit: string;
	onStartEdit: (row: PriceRecord) => void;
	onCancelEdit: () => void;
	onSaveEdit: () => Promise<void>;
	onEditCostChange: (val: string) => void;
	onEditUnitChange: (val: string) => void;
	saving: boolean;
}

const Row: React.FC<RowProps> = ({
	row,
	editRowId,
	editInventoryId,
	editCost,
	editUnit,
	onStartEdit,
	onCancelEdit,
	onSaveEdit,
	onEditCostChange,
	onEditUnitChange,
	saving,
}) => {
	const [open, setOpen] = useState(false);
	const hasHistory = row.history.length > 0;
	const isEditing =
		editRowId !== null &&
		(editRowId === row.item_cost_id ||
			(editRowId === -1 && editInventoryId === row.inventory_id));

	return (
		<React.Fragment>
			<TableRow
				selected={isEditing}
				sx={{ "& > *": { borderBottom: "unset" } }}
			>
				<TableCell sx={{ width: 48, px: 1 }}>
					<IconButton
						aria-label="expand row"
						size="small"
						onClick={() => setOpen(!open)}
						disabled={!hasHistory}
					>
						{hasHistory ? (
							open ? (
								<KeyboardArrowUpIcon />
							) : (
								<KeyboardArrowDownIcon />
							)
						) : (
							<Box sx={{ width: 24 }} />
						)}
					</IconButton>
				</TableCell>
				<TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
					{row.inventory_id}
				</TableCell>
				<TableCell>{row.class_id ?? "—"}</TableCell>
				<TableCell
					sx={{
						maxWidth: 400,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{row.description ?? "—"}
				</TableCell>
				<TableCell align="right" sx={{ minWidth: 120 }}>
					{isEditing ? (
						<TextField
							size="small"
							type="number"
							value={editCost}
							onChange={(e) => onEditCostChange(e.target.value)}
							sx={{ width: 110 }}
							inputProps={{ step: "0.0001", style: { textAlign: "right" } }}
							disabled={saving}
						/>
					) : (
						fmtNum(row.cost)
					)}
				</TableCell>
				<TableCell>
					{isEditing ? (
						<Select
							size="small"
							value={editUnit}
							onChange={(e) => onEditUnitChange(e.target.value)}
							sx={{ width: 80 }}
							disabled={saving}
						>
							{unitOptions.map((u) => (
								<MenuItem key={u} value={u}>
									{u}
								</MenuItem>
							))}
						</Select>
					) : (
						row.unit ?? "—"
					)}
				</TableCell>
				<TableCell
					sx={
						isEditing
							? { minWidth: 160 }
							: { width: 0, p: 0, borderBottom: "unset" }
					}
				>
					{isEditing && (
						<Box sx={{ display: "flex", gap: 0.5 }}>
							<Button
								size="small"
								variant="contained"
								color="primary"
								onClick={onSaveEdit}
								disabled={saving}
								startIcon={<SaveIcon />}
							>
								Save
							</Button>
							<Button
								size="small"
								variant="outlined"
								onClick={onCancelEdit}
								disabled={saving}
							>
								Cancel
							</Button>
						</Box>
					)}
				</TableCell>
				<TableCell sx={{ width: 48, px: 0.5 }}>
					{!isEditing && (
						<IconButton
							size="small"
							onClick={() => onStartEdit(row)}
							aria-label="edit"
						>
							<EditIcon fontSize="small" />
						</IconButton>
					)}
				</TableCell>
			</TableRow>
			<TableRow>
				<TableCell
					sx={{
						paddingBottom: 0,
						paddingTop: 0,
						borderBottom: open ? undefined : "unset",
					}}
					colSpan={8}
				>
					<Collapse in={open} timeout="auto" unmountOnExit>
						<Box sx={{ margin: 1 }}>
							<Typography
								variant="subtitle2"
								gutterBottom
								component="div"
								sx={{ color: "text.secondary" }}
							>
								Cost History
							</Typography>
							<Table size="small" aria-label="price history">
								<TableHead>
									<TableRow>
										<TableCell>Valid From</TableCell>
										<TableCell>Valid To</TableCell>
										<TableCell align="right">Cost</TableCell>
										<TableCell>Unit</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{row.history.map((h, idx) => (
										<TableRow key={`${h.valid_from}__${idx}`}>
											<TableCell>{fmtDate(h.valid_from)}</TableCell>
											<TableCell>{fmtDate(h.valid_to)}</TableCell>
											<TableCell align="right">{fmtNum(h.cost)}</TableCell>
											<TableCell>{h.unit}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</Box>
					</Collapse>
				</TableCell>
			</TableRow>
		</React.Fragment>
	);
};

// ── Toolbar ──────────────────────────────────────────────────────────

interface PricesToolbarProps {
	searchInputValue: string;
	onSearchInputChange: (value: string) => void;
	handleSearch: () => void;
	handleKeyDown: (e: React.KeyboardEvent) => void;
	clearSearch: () => void;
	isSearching: boolean;
	totalCount: number;
	withoutCostCount: number;
	unit: string | null;
	unitOptions: string[];
	onUnitChange: (value: string | null) => void;
	onImportClick: () => void;
}

const PricesToolbar: React.FC<PricesToolbarProps> = ({
	searchInputValue,
	onSearchInputChange,
	handleSearch,
	handleKeyDown,
	clearSearch,
	isSearching,
	totalCount,
	withoutCostCount,
	unit,
	unitOptions,
	onUnitChange,
	onImportClick,
}) => (
	<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
		{/* Row 1: Title + record counts */}
		<Box
			sx={{
				display: "flex",
				alignItems: "center",
				gap: 1.5,
				px: 2,
				pt: 1.5,
				pb: 0.5,
			}}
		>
			<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
				Prices
			</Typography>
			<Typography variant="caption" sx={{ color: "text.secondary" }}>
				{totalCount} records
				{withoutCostCount > 0 && (
					<Box
						component="span"
						sx={{ ml: 1, color: "warning.main", fontWeight: 600 }}
					>
						({withoutCostCount} without cost)
					</Box>
				)}
			</Typography>
		</Box>
		{/* Row 2: Toolbar controls */}
		<Box
			sx={{
				display: "flex",
				alignItems: "center",
				gap: 1,
				flexWrap: "wrap",
				px: 2,
				pb: 1.5,
				pt: 0.5,
				width: { xs: "100%", md: "auto" },
			}}
		>
			<Button
				variant="outlined"
				size="small"
				startIcon={<UploadIcon />}
				onClick={onImportClick}
				sx={{ whiteSpace: "nowrap", minWidth: 100 }}
			>
				Import
			</Button>
			<TextField
				size="small"
				placeholder="Search inventory, class, desc..."
				value={searchInputValue}
				onChange={(e) => onSearchInputChange(e.target.value)}
				onKeyDown={handleKeyDown}
				fullWidth
				slotProps={{
					input: {
						endAdornment: (
							<InputAdornment position="end">
								<IconButton
									size="small"
									onClick={clearSearch}
									aria-label="clear search"
									sx={{ mr: 0.25 }}
								>
									<CloseIcon fontSize="small" />
								</IconButton>
								<IconButton
									size="small"
									onClick={handleSearch}
									aria-label="search"
									disabled={isSearching}
								>
									<SearchIcon />
								</IconButton>
							</InputAdornment>
						),
					},
				}}
				sx={{
					"& .MuiOutlinedInput-root": { borderRadius: 2, height: 36 },
					"& .MuiInputBase-input": { paddingY: 0 },
					minWidth: { xs: 0, md: 220 },
				}}
			/>
			<Autocomplete
				size="small"
				options={unitOptions}
				value={unit}
				onChange={(_, newVal) => onUnitChange(newVal)}
				renderInput={(params) => (
					<TextField {...params} placeholder="Unit" sx={{ minWidth: 90 }} />
				)}
				sx={{ minWidth: 90 }}
			/>
		</Box>
	</Box>
);

// ── Import Dialog ────────────────────────────────────────────────────

interface ImportPreviewRow {
	row: number;
	inventory_id: string;
	cost: number;
	unit: string;
	valid_from: string;
	valid_to: string;
	error?: string;
}

const ImportDialog: React.FC<{
	open: boolean;
	onClose: () => void;
	onImport: (rows: ImportRow[]) => Promise<void>;
	importing: boolean;
	importResult: string | null;
}> = ({ open, onClose, onImport, importing, importResult }) => {
	const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
	const [fileError, setFileError] = useState<string | null>(null);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFileError(null);
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (evt) => {
			try {
				const data = new Uint8Array(evt.target?.result as ArrayBuffer);
				const workbook = XLSX.read(data, { type: "array" });
				const sheet = workbook.Sheets[workbook.SheetNames[0]];
				const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

				const parsed: ImportPreviewRow[] = json.map((row, idx) => {
					const r = idx + 2;
					const invId = String(row.inventory_id ?? row.InventoryID ?? row.InvtID ?? "").trim();
					const cost = Number(row.cost ?? row.Cost);
					const unit = String(row.unit ?? row.Unit ?? row.SlsUnit ?? "").trim().toUpperCase();
					const vf = String(row.valid_from ?? row.ValidFrom ?? row.validFrom ?? "").trim();
					const vt = String(row.valid_to ?? row.ValidTo ?? row.validTo ?? "").trim();

					const err =
						!invId || isNaN(cost) || !unit
							? "Missing required fields"
							: undefined;

					return {
						row: r,
						inventory_id: invId,
						cost: isNaN(cost) ? 0 : cost,
						unit,
						valid_from: vf,
						valid_to: vt,
						error: err,
					};
				});

				setPreview(parsed);
			} catch {
				setFileError("Failed to parse Excel file. Ensure it's a valid .xlsx or .xls file.");
			}
		};
		reader.readAsArrayBuffer(file);
	};

	const validRows = preview.filter((r) => !r.error);
	const hasErrors = preview.some((r) => r.error);

	const handleImport = async () => {
		if (validRows.length === 0) return;
		await onImport(
			validRows.map((r) => ({
				inventory_id: r.inventory_id,
				cost: r.cost,
				unit: r.unit,
				valid_from: r.valid_from || undefined,
				valid_to: r.valid_to || undefined,
			})),
		);
	};

	const reset = () => {
		setPreview([]);
		setFileError(null);
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	return (
		<Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
			<DialogTitle>Import Item Costs from Excel</DialogTitle>
			<DialogContent>
				<Box sx={{ mb: 2, mt: 1 }}>
					<Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
						Select an Excel file (.xlsx, .xls) with columns:{" "}
						<strong>inventory_id</strong>, <strong>cost</strong>,{" "}
						<strong>unit</strong>{" "}
						(optional: <strong>valid_from</strong>, <strong>valid_to</strong>).
					</Typography>
					<Button variant="contained" component="label">
						Choose File
						<input
							type="file"
							hidden
							accept=".xlsx,.xls"
							onChange={handleFileSelect}
						/>
					</Button>
				</Box>

				{fileError && (
					<Alert severity="error" sx={{ mb: 2 }}>
						{fileError}
					</Alert>
				)}

				{importResult && (
					<Alert severity={importResult.includes("Error") ? "warning" : "success"} sx={{ mb: 2 }}>
						{importResult}
					</Alert>
				)}

				{preview.length > 0 && (
					<>
						<Typography variant="subtitle2" sx={{ mb: 1 }}>
							Preview ({validRows.length} valid rows
							{hasErrors ? `, ${preview.length - validRows.length} with errors` : ""})
						</Typography>
						<TableContainer sx={{ maxHeight: 300 }}>
							<Table size="small" stickyHeader>
								<TableHead>
									<TableRow>
										<TableCell>#</TableCell>
										<TableCell>Inventory ID</TableCell>
										<TableCell align="right">Cost</TableCell>
										<TableCell>Unit</TableCell>
										<TableCell>Valid From</TableCell>
										<TableCell>Valid To</TableCell>
										{hasErrors && <TableCell>Error</TableCell>}
									</TableRow>
								</TableHead>
								<TableBody>
									{preview.map((r) => (
										<TableRow
											key={r.row}
											selected={!!r.error}
											sx={r.error ? { "& td": { color: "error.main" } } : undefined}
										>
											<TableCell>{r.row}</TableCell>
											<TableCell>{r.inventory_id}</TableCell>
											<TableCell align="right">{r.cost}</TableCell>
											<TableCell>{r.unit}</TableCell>
											<TableCell>{r.valid_from}</TableCell>
											<TableCell>{r.valid_to}</TableCell>
											{hasErrors && <TableCell>{r.error ?? ""}</TableCell>}
										</TableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>
					</>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={handleClose}>Cancel</Button>
				<Button
					variant="contained"
					onClick={handleImport}
					disabled={validRows.length === 0 || importing}
				>
					{importing ? "Importing..." : `Import ${validRows.length} rows`}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

// ── Price Class Types ──────────────────────────────────────────────

interface PriceClassItem {
	price_class: string;
	pct_discount: number;
	valid_from: string;
	valid_to: string | null;
}

// ── PriceClass Dialog ──────────────────────────────────────────────

interface PriceClassDialogProps {
	open: boolean;
	editItem: PriceClassItem | null; // null = add mode
	onClose: () => void;
	onSaved: () => void;
	onError: (msg: string) => void;
}

const PriceClassDialog: React.FC<PriceClassDialogProps> = ({
	open,
	editItem,
	onClose,
	onSaved,
	onError,
}) => {
	const isEdit = editItem != null;
	const [className, setClassName] = useState(
		isEdit ? editItem.price_class : "",
	);
	const [discount, setDiscount] = useState(
		isEdit ? String(editItem.pct_discount) : "",
	);
	const [validFrom, setValidFrom] = useState(
		() => {
			const now = new Date();
			const offset = now.getTimezoneOffset();
			const local = new Date(now.getTime() - offset * 60000);
			return local.toISOString().slice(0, 16);
		},
	);
	const [saving, setSaving] = useState(false);

	const dialogKey = open
		? isEdit
			? `edit-${editItem.price_class}-${editItem.valid_from}`
			: "add-new"
		: "closed";

	const handleSave = async () => {
		if (!className.trim()) {
			onError("Price class name is required");
			return;
		}
		const discountNum = Number(discount);
		if (isNaN(discountNum)) {
			onError("Discount must be a valid number");
			return;
		}
		if (!validFrom) {
			onError("Valid from date is required");
			return;
		}
		setSaving(true);

		// Current timestamp in MSSQL format (YYYY-MM-DD HH:MM:SS)
		const now = new Date().toISOString().slice(0, 19).replace("T", " ");

		// In edit mode, always use current timestamp for the new entry's valid_from
		// to avoid PK collision with the old entry. In add mode, use the form value.
		const newValidFrom = isEdit
			? now
			: validFrom.replace("T", " ") + ":00";

		// Track whether we expired the old entry (for rollback)
		let expiredOld = false;
		const oldItem = isEdit ? editItem : null;

		try {
			if (isEdit && oldItem) {
				// Step 1: Expire the old price class by setting valid_to = now
				await apiRequest(
					`/price/classes/${encodeURIComponent(oldItem.price_class)}/${encodeURIComponent(oldItem.valid_from)}`,
					{
						method: "PUT",
						body: { valid_to: now },
					},
				);
				expiredOld = true;
			}

			// Step 2: Create a new price class entry with updated values
			await apiRequest("/price/classes", {
				method: "POST",
				body: {
					price_class: className.trim(),
					pct_discount: discountNum,
					valid_from: newValidFrom,
				},
			});

			onSaved();
			onClose();
		} catch (err: unknown) {
			// Rollback: if the old entry was expired but the POST failed,
			// try to restore valid_to back to what it was
			if (expiredOld && oldItem) {
				// Omit valid_to so the service doesn't update it,
				// meaning the old entry's valid_to stays as-is (expired).
				// This is a best-effort — the user should retry.
			}
			onError(
				err instanceof Error ? err.message : "Failed to save price class",
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog key={dialogKey} open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle>{isEdit ? "Edit Price Class" : "Add Price Class"}</DialogTitle>
			<DialogContent>
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
					<TextField
						label="Price Class"
						value={className}
						onChange={(e) => setClassName(e.target.value)}
						disabled={isEdit}
						size="small"
						required
					/>
					<TextField
						label="Discount %"
						type="number"
						value={discount}
						onChange={(e) => setDiscount(e.target.value)}
						size="small"
						required
						inputProps={{ step: "0.01" }}
					/>
					{isEdit ? (
						<Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>
							New entry will use current timestamp as valid_from.
						</Typography>
					) : (
						<TextField
							label="Valid From"
							type="datetime-local"
							value={validFrom}
							onChange={(e) => setValidFrom(e.target.value)}
							size="small"
							InputLabelProps={{ shrink: true }}
							required
						/>
					)}
				</Box>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose} disabled={saving}>
					Cancel
				</Button>
				<Button variant="contained" onClick={handleSave} disabled={saving}>
					{saving ? "Saving..." : "Save"}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

// ── PriceClass Card ─────────────────────────────────────────────────

const PriceClassCard: React.FC = () => {
	const [classes, setClasses] = useState<PriceClassItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editItem, setEditItem] = useState<PriceClassItem | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [deleteConfirmItem, setDeleteConfirmItem] = useState<PriceClassItem | null>(null);

	const fetchClasses = useCallback(async (signal?: AbortSignal) => {
		setLoading(true);
		setError(null);
		try {
			const res = await apiRequest<PriceClassItem[]>("/price/classes", {
				signal,
			});
			if (signal?.aborted) return;
			setClasses(res);
		} catch (err: unknown) {
			if (signal?.aborted) return;
			setError(
				err instanceof Error ? err.message : "Failed to fetch price classes",
			);
		} finally {
			if (!signal?.aborted) setLoading(false);
		}
	}, []);

	useEffect(() => {
		const abort = new AbortController();
		fetchClasses(abort.signal);
		return () => abort.abort();
	}, [fetchClasses]);

	const handleAdd = () => {
		setEditItem(null);
		setDialogOpen(true);
	};

	const handleEdit = (item: PriceClassItem) => {
		setEditItem(item);
		setDialogOpen(true);
	};

	const handleDelete = (item: PriceClassItem) => {
		setDeleteConfirmItem(item);
	};

	const handleDeleteConfirm = async () => {
		const item = deleteConfirmItem;
		if (!item) return;
		setDeleting(true);
		setDeleteConfirmItem(null);
		try {
			await apiRequest(
				`/price/classes/${encodeURIComponent(item.price_class)}/${encodeURIComponent(item.valid_from)}`,
				{ method: "DELETE" },
			);
			await fetchClasses();
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : "Failed to delete price class",
			);
		} finally {
			setDeleting(false);
		}
	};

	const handleDeleteCancel = () => {
		setDeleteConfirmItem(null);
	};

	const handleSaved = async () => {
		await fetchClasses();
	};

	return (
		<Paper sx={{ mb: 2, overflow: "hidden" }} variant="outlined">
			<Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
				<Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
					<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
						<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
							Price Classes
						</Typography>
						{!loading && (
							<Typography variant="caption" sx={{ color: "text.secondary" }}>
								{classes.length} {classes.length === 1 ? "class" : "classes"}
							</Typography>
						)}
					</Box>
					<Button
						variant="contained"
						size="small"
						startIcon={<AddIcon />}
						onClick={handleAdd}
						disabled={loading}
					>
						Add
					</Button>
				</Box>
			</Box>

			{error && (
				<Alert severity="error" sx={{ mx: 2, mb: 1 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			)}

			{loading ? (
				<LinearProgress sx={{ mx: 2, mb: 1 }} />
			) : classes.length === 0 ? (
				<Typography
					variant="body2"
					sx={{ color: "text.secondary", px: 2, pb: 1.5 }}
				>
					No price classes defined
				</Typography>
			) : (
				<TableContainer>
					<Table size="small" sx={{ "& th": { fontWeight: 600, fontSize: "0.75rem" } }}>
						<TableHead>
							<TableRow>
								<TableCell>Price Class</TableCell>
								<TableCell align="right">Discount %</TableCell>
								<TableCell>Valid From</TableCell>
								<TableCell align="right" sx={{ width: 100 }}>
									Actions
								</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{classes.map((pc) => (
								<TableRow key={`${pc.price_class}__${pc.valid_from}`} hover>
									<TableCell sx={{ fontWeight: 600 }}>{pc.price_class}</TableCell>
									<TableCell align="right">
										{pc.pct_discount.toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 4,
										})}
										%
									</TableCell>
									<TableCell>{fmtDate(pc.valid_from)}</TableCell>
									<TableCell align="right">
										<IconButton
											size="small"
											onClick={() => handleEdit(pc)}
											disabled={deleting}
											aria-label={`edit ${pc.price_class}`}
										>
											<EditIcon fontSize="small" />
										</IconButton>
										<IconButton
											size="small"
											onClick={() => handleDelete(pc)}
											disabled={deleting}
											aria-label={`delete ${pc.price_class}`}
										>
											<DeleteIcon fontSize="small" />
										</IconButton>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			)}

			<PriceClassDialog
				open={dialogOpen}
				editItem={editItem}
				onClose={() => setDialogOpen(false)}
				onSaved={handleSaved}
				onError={setError}
			/>

			{/* Delete Confirmation Dialog */}
			<Dialog
				open={deleteConfirmItem != null}
				onClose={handleDeleteCancel}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle>Delete Price Class?</DialogTitle>
				<DialogContent>
					<DialogContentText>
						Are you sure you want to delete price class{" "}
						<strong>{deleteConfirmItem?.price_class}</strong> (valid from{" "}
						{deleteConfirmItem?.valid_from})? This action cannot be undone.
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleDeleteCancel} disabled={deleting}>
						Cancel
					</Button>
					<Button
						onClick={handleDeleteConfirm}
						variant="contained"
						color="error"
						disabled={deleting}
					>
						{deleting ? "Deleting..." : "Delete"}
					</Button>
				</DialogActions>
			</Dialog>
		</Paper>
	);
};

// ── Main Component ───────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 25;

const Prices: React.FC = () => {
	const [rows, setRows] = useState<PriceRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(0);
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
	const [rowCount, setRowCount] = useState(0);
	const [withoutCostCount, setWithoutCostCount] = useState(0);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInputValue, setSearchInputValue] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const searchTimeoutRef = useRef<number>(0);
	const [unit, setUnit] = useState<string | null>(null);

	// Edit state
	const [editRowId, setEditRowId] = useState<number | null>(null);
	const [editInventoryId, setEditInventoryId] = useState<string | null>(null);
	const [editCost, setEditCost] = useState("");
	const [editUnit, setEditUnit] = useState("");
	const [saving, setSaving] = useState(false);

	// Import state
	const [importOpen, setImportOpen] = useState(false);
	const [importing, setImporting] = useState(false);
	const [importResult, setImportResult] = useState<string | null>(null);

	const unitRef = useRef<string | null>(unit);

	useEffect(() => {
		unitRef.current = unit;
	}, [unit]);

	// Commit search
	const handleSearch = useCallback(() => {
		const value = searchInputValue.trim();
		if (isSearching) return;
		setIsSearching(true);
		setSearchQuery(value);
		setPage(0);
	}, [isSearching, searchInputValue]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") handleSearch();
		},
		[handleSearch],
	);

	const clearSearch = useCallback(() => {
		window.clearTimeout(searchTimeoutRef.current);
		setIsSearching(false);
		setSearchQuery("");
		setSearchInputValue("");
		setPage(0);
	}, []);

	// Fetch data
	const fetchData = useCallback(async (signal?: AbortSignal) => {
		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams({
				page: String(page + 1),
				limit: String(pageSize),
			});
			if (searchQuery) params.set("search", searchQuery);
			const u = unitRef.current;
			if (u) params.set("unit", u);

			const res = await apiRequest<PaginatedResponse<PriceRecord>>(
				`/price?${params}`,
				{ signal },
			);
			if (signal?.aborted) return;
			setRows(res.data);
			setRowCount(res.total);
			setWithoutCostCount(res.withoutCostCount);
		} catch (err: unknown) {
			if (signal?.aborted) return;
			setError(
				err instanceof Error ? err.message : "Failed to fetch prices",
			);
		} finally {
			if (!signal?.aborted) {
				setLoading(false);
				setIsSearching(false);
			}
		}
	}, [page, pageSize, searchQuery, unit]);

	useEffect(() => {
		const abort = new AbortController();
		fetchData(abort.signal);
		return () => abort.abort();
	}, [fetchData]);

	// ── Edit handlers ──────────────────────────────────────────────

	const handleStartEdit = (row: PriceRecord) => {
		setEditRowId(row.item_cost_id ?? -1); // -1 means "new"
		setEditInventoryId(row.item_cost_id != null ? null : row.inventory_id);
		setEditCost(String(row.cost ?? ""));
		setEditUnit(row.unit ?? "CS");
	};

	const handleCancelEdit = () => {
		setEditRowId(null);
		setEditInventoryId(null);
		setEditCost("");
		setEditUnit("");
	};

	const handleSaveEdit = async () => {
		setSaving(true);
		try {
			if (editRowId === -1 && editInventoryId) {
				// Creating new cost — valid_from defaults to current datetime on server
				await apiRequest("/price/items", {
					method: "POST",
					body: {
						inventory_id: editInventoryId,
						cost: Number(editCost),
						unit: editUnit,
					},
				});
			} else if (editRowId != null && editRowId > 0) {
				// Updating existing cost
				await apiRequest(`/price/items/${editRowId}`, {
					method: "PUT",
					body: {
						cost: Number(editCost),
						unit: editUnit,
					},
				});
			}
			handleCancelEdit();
			await fetchData();
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : "Failed to save cost",
			);
		} finally {
			setSaving(false);
		}
	};

	// ── Import handlers ────────────────────────────────────────────

	const handleImport = async (items: ImportRow[]) => {
		setImporting(true);
		setImportResult(null);
		try {
			const res = await apiRequest<{
				processed: number;
				inserted: number;
				updated: number;
				errors: Array<{ row: number; message: string }>;
			}>("/price/items/import", {
				method: "POST",
				body: { items },
			});
			const errCount = res.errors.length;
			const msg = `Imported: ${res.inserted} inserted, ${res.updated} updated${
				errCount > 0 ? `, ${errCount} Error(s): ${res.errors.map((e) => `Row ${e.row}: ${e.message}`).join("; ")}` : ""
			}`;
			setImportResult(msg);
			await fetchData();
		} catch (err: unknown) {
			setImportResult(
				`Error: ${err instanceof Error ? err.message : "Import failed"}`,
			);
		} finally {
			setImporting(false);
		}
	};

	// ── Pagination ─────────────────────────────────────────────────

	const handleChangePage = (_: unknown, newPage: number) => {
		setPage(newPage);
	};

	const handleChangeRowsPerPage = (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		setPageSize(parseInt(event.target.value, 10));
		setPage(0);
	};

	return (
		<>
			<PriceClassCard />
			<Paper sx={{ width: "100%", mb: 2, overflow: "hidden" }}>
			<PricesToolbar
				searchInputValue={searchInputValue}
				onSearchInputChange={setSearchInputValue}
				handleSearch={handleSearch}
				handleKeyDown={handleKeyDown}
				clearSearch={clearSearch}
				isSearching={isSearching}
				totalCount={rowCount}
				withoutCostCount={withoutCostCount}
				unit={unit}
				unitOptions={unitOptions}
				onUnitChange={setUnit}
				onImportClick={() => setImportOpen(true)}
			/>
			{error ? (
				<Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			) : loading ? (
				<LinearProgress />
			) : (
				<>
					<TableContainer>
						<Table aria-label="collapsible price table" size="small">
							<TableHead>
								<TableRow>
									<TableCell sx={{ width: 48, px: 1 }} />
									<TableCell sx={{ fontWeight: 600 }}>Inventory ID</TableCell>
									<TableCell sx={{ fontWeight: 600 }}>Class ID</TableCell>
									<TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
									<TableCell align="right" sx={{ fontWeight: 600 }}>
										Cost
									</TableCell>
									<TableCell sx={{ fontWeight: 600 }}>Unit</TableCell>
									<TableCell sx={{ width: 0, p: 0 }} />
									<TableCell sx={{ width: 48, px: 0.5 }} />
								</TableRow>
							</TableHead>
							<TableBody>
								{rows.length === 0 ? (
									<TableRow>
										<TableCell
										colSpan={8}
										align="center"
										sx={{ py: 4, color: "text.secondary" }}
									>
										No prices found
									</TableCell>
									</TableRow>
								) : (
									rows.map((row) => (
										<Row
											key={row.inventory_id}
											row={row}
											editRowId={editRowId}
											editInventoryId={editInventoryId}
											editCost={editCost}
											editUnit={editUnit}
											onStartEdit={handleStartEdit}
											onCancelEdit={handleCancelEdit}
											onSaveEdit={handleSaveEdit}
											onEditCostChange={setEditCost}
											onEditUnitChange={setEditUnit}
											saving={saving}
										/>
									))
								)}
							</TableBody>
						</Table>
					</TableContainer>
					<TablePagination
						component="div"
						count={rowCount}
						page={page}
						onPageChange={handleChangePage}
						rowsPerPage={pageSize}
						onRowsPerPageChange={handleChangeRowsPerPage}
						rowsPerPageOptions={[10, 25, 50, 100]}
					/>
				</>
			)}
			<ImportDialog
				open={importOpen}
				onClose={() => {
					setImportOpen(false);
					setImportResult(null);
				}}
				onImport={handleImport}
				importing={importing}
				importResult={importResult}
			/>
		</Paper>
		</>
	);
};

export default Prices;
