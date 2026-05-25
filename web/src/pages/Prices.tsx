import React, {
	useState,
	useEffect,
	useCallback,
	useRef,
	useMemo,
} from "react";
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
	Skeleton,
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
import Big from "big.js";

// ── Types matching refactored price.schema.ts ─────────────────────────

interface PriceHistoryEntry {
	valid_from: string;
	valid_to: string | null;
	price: number;
	unit: string;
}

interface PriceRecord {
	item_price_id: number | null;
	inventory_id: string;
	class_id: string | null;
	description: string | null;
	price: number | null;
	unit: string | null;
	price_class: string | null;
	history: PriceHistoryEntry[];
}

interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	withoutPriceCount: number;
}

interface ImportRow {
	inventory_id: string;
	price: number;
	unit: string;
	price_class: string;
	valid_from?: string;
	valid_to?: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────

function fmtNum(val: Big | number | null | undefined): string {
	if (val === null || val === undefined) return "—";
	const n = val instanceof Big ? Number(val.toFixed(4)) : val;
	return n.toLocaleString(undefined, {
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
	editPrice: string;
	editUnit: string;
	editPriceClass: string;
	onStartEdit: (row: PriceRecord) => void;
	onCancelEdit: () => void;
	onSaveEdit: () => Promise<void>;
	onEditPriceChange: (val: string) => void;
	onEditUnitChange: (val: string) => void;
	onEditPriceClassChange: (val: string) => void;
	priceClassOptions: string[];
	saving: boolean;
}

const Row: React.FC<RowProps> = ({
	row,
	editRowId,
	editInventoryId,
	editPrice,
	editUnit,
	editPriceClass,
	onStartEdit,
	onCancelEdit,
	onSaveEdit,
	onEditPriceChange,
	onEditUnitChange,
	onEditPriceClassChange,
	priceClassOptions,
	saving,
}) => {
	const [open, setOpen] = useState(false);
	const hasHistory = row.history.length > 0;
	const isEditing =
		editRowId !== null &&
		(editRowId === row.item_price_id ||
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
							value={editPrice}
							onChange={(e) => onEditPriceChange(e.target.value)}
							sx={{ width: 110 }}
							slotProps={{
								htmlInput: { step: "1.0", style: { textAlign: "right" } },
							}}
							disabled={saving}
						/>
					) : (
						fmtNum(row.price)
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
				<TableCell>
					{isEditing ? (
						<Autocomplete
							size="small"
							freeSolo
							options={priceClassOptions}
							value={editPriceClass}
							onChange={(_, newVal) => onEditPriceClassChange(newVal ?? "")}
							onInputChange={(_, newVal) => onEditPriceClassChange(newVal)}
							renderInput={(params) => (
								<TextField
									{...params}
									sx={{ width: 130 }}
									slotProps={{ htmlInput: { ...params.inputProps, maxLength: 30 } }}
								/>
							)}
							sx={{ width: 130 }}
							disabled={saving}
						/>
					) : (
						row.price_class ?? "—"
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
						<Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
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
				<TableCell sx={{ width: 48, px: 0.5, textAlign: "right" }}>
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
					colSpan={9}
				>
					<Collapse in={open} timeout="auto" unmountOnExit>
						<Box sx={{ margin: 1 }}>
							<Typography
								variant="subtitle2"
								gutterBottom
								component="div"
								sx={{ color: "text.secondary" }}
							>
								Price History
							</Typography>
							<Table size="small" aria-label="price history">
								<TableHead>
									<TableRow>
										<TableCell>Valid From</TableCell>
										<TableCell>Valid To</TableCell>
										<TableCell align="right">Price</TableCell>
										<TableCell>Unit</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{row.history.map((h, idx) => (
										<TableRow key={`${h.valid_from}__${idx}`}>
											<TableCell>{fmtDate(h.valid_from)}</TableCell>
											<TableCell>{fmtDate(h.valid_to)}</TableCell>
											<TableCell align="right">{fmtNum(h.price)}</TableCell>
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
	withoutPriceCount: number;
	unit: string | null;
	unitOptions: string[];
	onUnitChange: (value: string | null) => void;
	onImportClick: () => void;
	priceClassOptions: string[];
	selectedPriceClass: string | null;
	onPriceClassChange: (value: string | null) => void;
}

const PricesToolbar: React.FC<PricesToolbarProps> = ({
	searchInputValue,
	onSearchInputChange,
	handleSearch,
	handleKeyDown,
	clearSearch,
	isSearching,
	totalCount,
	withoutPriceCount,
	unit,
	unitOptions,
	onUnitChange,
	onImportClick,
	priceClassOptions,
	selectedPriceClass,
	onPriceClassChange,
}) => (
	<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
		{/* Row 1: Title + record counts + Import button */}
		<Box
			sx={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				px: 2,
				pt: 1.5,
				pb: 1.5,
			}}
		>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
				<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
					Prices
				</Typography>
				<Typography variant="caption" sx={{ color: "text.secondary" }}>
					{totalCount} records
					{withoutPriceCount > 0 && (
						<Box
							component="span"
							sx={{ ml: 1, color: "warning.main", fontWeight: 600 }}
						>
							({withoutPriceCount} without price)
						</Box>
					)}
				</Typography>
			</Box>
			<Button
				variant="outlined"
				size="small"
				startIcon={<UploadIcon />}
				onClick={onImportClick}
				sx={{ whiteSpace: "nowrap", minWidth: 100 }}
			>
				Import
			</Button>
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
			}}
		>
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
			<Autocomplete
				size="small"
				options={priceClassOptions}
				value={selectedPriceClass}
				onChange={(_, newVal) => onPriceClassChange(newVal)}
				renderInput={(params) => (
					<TextField
						{...params}
						placeholder="Price Class"
						sx={{ minWidth: 130 }}
					/>
				)}
				sx={{ minWidth: 130 }}
			/>
		</Box>
	</Box>
);

// ── Import Dialog ────────────────────────────────────────────────────

interface ImportPreviewRow {
	row: number;
	inventory_id: string;
	price: number;
	unit: string;
	price_class: string;
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
					const invId = String(
						row.inventory_id ?? row.InventoryID ?? row.InvtID ?? "",
					).trim();
					// Wrap raw XLSX float in Big and round to 4dp to kill IEEE 754 noise
					const priceRaw = Number(row.price ?? row.Price ?? row.Cost ?? 0);
					const price = isNaN(priceRaw)
						? 0
						: Number(new Big(priceRaw).toFixed(4));
					const unit = String(row.unit ?? row.Unit ?? row.SlsUnit ?? "")
						.trim()
						.toUpperCase();
					const priceClass = String(
						row.price_class ?? row.PriceClass ?? row.priceClass ?? "",
					).trim();
					const vf = String(
						row.valid_from ?? row.ValidFrom ?? row.validFrom ?? "",
					).trim();
					const vt = String(
						row.valid_to ?? row.ValidTo ?? row.validTo ?? "",
					).trim();

					const err =
						!invId || isNaN(price) || !unit || !priceClass
							? "Missing required fields"
							: undefined;

					return {
						row: r,
						inventory_id: invId,
						price: isNaN(price) ? 0 : price,
						unit,
						price_class: priceClass,
						valid_from: vf,
						valid_to: vt,
						error: err,
					};
				});

				setPreview(parsed);
			} catch {
				setFileError(
					"Failed to parse Excel file. Ensure it's a valid .xlsx or .xls file.",
				);
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
				price: r.price,
				unit: r.unit,
				price_class: r.price_class,
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
			<DialogTitle>Import Item Prices from Excel</DialogTitle>
			<DialogContent>
				<Box sx={{ mb: 2, mt: 1 }}>
					<Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
						Select an Excel file (.xlsx, .xls) with columns:{" "}
						<strong>inventory_id</strong>, <strong>price</strong>,{" "}
						<strong>unit</strong>, <strong>price_class</strong>{" "}
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
					<Alert
						severity={importResult.includes("Error") ? "warning" : "success"}
						sx={{ mb: 2 }}
					>
						{importResult}
					</Alert>
				)}

				{preview.length > 0 && (
					<>
						<Typography variant="subtitle2" sx={{ mb: 1 }}>
							Preview ({validRows.length} valid rows
							{hasErrors
								? `, ${preview.length - validRows.length} with errors`
								: ""}
							)
						</Typography>
						<TableContainer sx={{ maxHeight: 300 }}>
							<Table size="small" stickyHeader>
								<TableHead>
									<TableRow>
										<TableCell>#</TableCell>
										<TableCell>Inventory ID</TableCell>
										<TableCell align="right">Price</TableCell>
										<TableCell>Unit</TableCell>
										<TableCell>Price Class</TableCell>
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
											sx={
												r.error
													? { "& td": { color: "error.main" } }
													: undefined
											}
										>
											<TableCell>{r.row}</TableCell>
											<TableCell>{r.inventory_id}</TableCell>
											<TableCell align="right">{fmtNum(r.price)}</TableCell>
											<TableCell>{r.unit}</TableCell>
											<TableCell>{r.price_class}</TableCell>
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

// ── Price Class Types (simplified lookup) ──────────────────────────

interface PriceClassItem {
	id: string;
	description: string | null;
}

// ── PriceClass Dialog (simplified) ────────────────────────────────

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
	const [classId, setClassId] = useState("");
	const [description, setDescription] = useState("");
	const [saving, setSaving] = useState(false);
	const [dialogError, setDialogError] = useState<string | null>(null);

	// Sync state when dialog opens with a different editItem
	useEffect(() => {
		setClassId(isEdit ? editItem.id : "");
		setDescription(isEdit ? editItem.description ?? "" : "");
		setDialogError(null);
	}, [open, isEdit, editItem]);

	const dialogKey = open
		? isEdit
			? `edit-${editItem.id}`
			: "add-new"
		: "closed";

	const handleSave = async () => {
		setDialogError(null);

		if (!classId.trim()) {
			setDialogError("Price class ID is required");
			return;
		}

		setSaving(true);

		try {
			if (isEdit) {
				await apiRequest(`/price/classes/${encodeURIComponent(classId)}`, {
					method: "PUT",
					body: { description: description.trim() || null },
				});
			} else {
				await apiRequest("/price/classes", {
					method: "POST",
					body: {
						id: classId.trim(),
						description: description.trim() || null,
					},
				});
			}

			onSaved();
			onClose();
		} catch (err: unknown) {
			const msg =
				err instanceof Error ? err.message : "Failed to save price class";
			setDialogError(msg);
			onError(msg);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog
			key={dialogKey}
			open={open}
			onClose={onClose}
			maxWidth="sm"
			fullWidth
		>
			<DialogTitle>
				{isEdit ? "Edit Price Class" : "Add Price Class"}
			</DialogTitle>
			<DialogContent>
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
					{dialogError && (
						<Alert
							severity="error"
							onClose={() => setDialogError(null)}
							sx={{ mb: 1 }}
						>
							{dialogError}
						</Alert>
					)}
					<TextField
						label="Price Class ID"
						value={classId}
						onChange={(e) => {
							setClassId(e.target.value);
							setDialogError(null);
						}}
						disabled={isEdit}
						size="small"
						required
					/>
					<TextField
						label="Description"
						value={description}
						onChange={(e) => {
							setDescription(e.target.value);
							setDialogError(null);
						}}
						size="small"
						multiline
						rows={2}
					/>
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

// ── PriceClass Row (simplified — no history, no discount) ─────────

interface PriceClassRowProps {
	pc: PriceClassItem;
	editingId: string | null;
	onEdit: (item: PriceClassItem) => void;
	onDelete: (item: PriceClassItem) => void;
	deleting: boolean;
}

const PriceClassRowComponent: React.FC<PriceClassRowProps> = ({
	pc,
	editingId,
	onEdit,
	onDelete,
	deleting,
}) => {
	const isEditing = editingId === pc.id;

	return (
		<TableRow
			selected={isEditing}
			sx={{ "& > *": { borderBottom: "unset" } }}
		>
			<TableCell sx={{ fontWeight: 600 }}>{pc.id}</TableCell>
			<TableCell>{pc.description ?? "—"}</TableCell>
			<TableCell align="right" sx={{ width: 100 }}>
				<IconButton
					size="small"
					onClick={() => onEdit(pc)}
					disabled={deleting}
					aria-label={`edit ${pc.id}`}
				>
					<EditIcon fontSize="small" />
				</IconButton>
				<IconButton
					size="small"
					onClick={() => onDelete(pc)}
					disabled={deleting}
					aria-label={`delete ${pc.id}`}
				>
					<DeleteIcon fontSize="small" />
				</IconButton>
			</TableCell>
		</TableRow>
	);
};

// ── PriceClass Card (simplified) ──────────────────────────────────

interface PriceClassCardProps {
	classes: PriceClassItem[];
	loading: boolean;
	error: string | null;
	onError: (msg: string | null) => void;
	onRefresh: () => Promise<void>;
}

const PriceClassCard: React.FC<PriceClassCardProps> = ({
	classes,
	loading,
	error,
	onError,
	onRefresh,
}) => {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editItem, setEditItem] = useState<PriceClassItem | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [deleteConfirmItem, setDeleteConfirmItem] =
		useState<PriceClassItem | null>(null);

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
			await apiRequest(`/price/classes/${encodeURIComponent(item.id)}`, {
				method: "DELETE",
			});
			await onRefresh();
		} catch (err: unknown) {
			onError(
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
		await onRefresh();
	};

	return (
		<Paper sx={{ mb: 2, overflow: "hidden" }}>
			<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						px: 2,
						pt: 1.5,
						pb: 1.5,
					}}
				>
					<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
						<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
							Price Classes
						</Typography>
						{!loading && (
							<Typography variant="caption" sx={{ color: "text.secondary" }}>
								{classes.length}{" "}
								{classes.length === 1 ? "class" : "classes"}
							</Typography>
						)}
					</Box>
					<Button
						variant="outlined"
						size="small"
						startIcon={<AddIcon />}
						onClick={handleAdd}
						disabled={loading}
						sx={{ whiteSpace: "nowrap", minWidth: 100 }}
					>
						Add
					</Button>
				</Box>
			</Box>

			{error && (
				<Alert
					severity="error"
					sx={{ mx: 2, mb: 1 }}
					onClose={() => onError(null)}
				>
					{error}
				</Alert>
			)}

			{loading ? (
				<TableSkeleton
					cols={[{}, {}, { icon: true, align: "right" }]}
					rows={4}
				/>
			) : classes.length === 0 ? (
				<Typography
					variant="body2"
					sx={{ color: "text.secondary", px: 2, pb: 1.5 }}
				>
					No price classes defined
				</Typography>
			) : (
				<TableContainer>
					<Table
						size="small"
						sx={{ "& th": { fontWeight: 600, fontSize: "0.75rem" } }}
					>
						<TableHead>
							<TableRow>
								<TableCell>Price Class</TableCell>
								<TableCell>Description</TableCell>
								<TableCell align="right" sx={{ width: 100 }}>
									Actions
								</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{classes.map((pc) => (
								<PriceClassRowComponent
									key={pc.id}
									pc={pc}
									editingId={editItem?.id ?? null}
									onEdit={handleEdit}
									onDelete={handleDelete}
									deleting={deleting}
								/>
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
				onError={onError}
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
						<strong>{deleteConfirmItem?.id}</strong>? This action cannot be
						undone.
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

// ── Table Skeleton ─────────────────────────────────────────────────

interface SkeletonCol {
	align?: "left" | "right" | "center";
	icon?: boolean;
	spacer?: boolean;
}

function skelWidthPct(row: number, col: number): number {
	return 40 + ((row * 7 + col * 13 + col * 3) % 51);
}

const TableSkeleton: React.FC<{ cols: SkeletonCol[]; rows?: number }> = ({
	cols,
	rows = 5,
}) => (
	<TableContainer>
		<Table size="small">
			<TableBody>
				{Array.from({ length: rows }, (_, i) => (
					<TableRow key={i}>
						{cols.map((col, j) =>
							col.spacer ? (
								<TableCell
									key={j}
									sx={{ p: 0, width: 0, borderBottom: "unset" }}
								/>
							) : col.icon ? (
								<TableCell
									key={j}
									sx={{ width: 48, px: 1, textAlign: col.align ?? "left" }}
								>
									<Skeleton
										animation="wave"
										variant="circular"
										width={20}
										height={20}
									/>
								</TableCell>
							) : (
								<TableCell key={j} sx={{ textAlign: col.align ?? "left" }}>
									<Skeleton
										animation="wave"
										variant="text"
										sx={{
											width: `${skelWidthPct(i, j)}%`,
											maxWidth: 120,
											display: "inline-block",
										}}
									/>
								</TableCell>
							),
						)}
					</TableRow>
				))}
			</TableBody>
		</Table>
	</TableContainer>
);

// ── Main Component ───────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 25;

const Prices: React.FC = () => {
	const [rows, setRows] = useState<PriceRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(0);
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
	const [rowCount, setRowCount] = useState(0);
	const [withoutPriceCount, setWithoutPriceCount] = useState(0);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInputValue, setSearchInputValue] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const searchTimeoutRef = useRef<number>(0);
	const [unit, setUnit] = useState<string | null>(null);

	// Price class filter state
	const [priceClassOptions, setPriceClassOptions] = useState<string[]>([]);
	const [selectedPriceClass, setSelectedPriceClass] = useState<string | null>(
		null,
	);

	// Shared full classes data (for PriceClassCard + filter derivation)
	const [allClasses, setAllClasses] = useState<PriceClassItem[]>([]);
	const [classesLoading, setClassesLoading] = useState(true);
	const [classesError, setClassesError] = useState<string | null>(null);

	// Edit state
	const [editRowId, setEditRowId] = useState<number | null>(null);
	const [editInventoryId, setEditInventoryId] = useState<string | null>(null);
	const [editPrice, setEditPrice] = useState("");
	const [editUnit, setEditUnit] = useState("");
	const [editPriceClass, setEditPriceClass] = useState("");
	const [saving, setSaving] = useState(false);

	// Import state
	const [importOpen, setImportOpen] = useState(false);
	const [importing, setImporting] = useState(false);
	const [importResult, setImportResult] = useState<string | null>(null);

	const unitRef = useRef<string | null>(unit);

	useEffect(() => {
		unitRef.current = unit;
	}, [unit]);

	// Single fetch for price classes: populates filter + PriceClassCard data
	const fetchPriceClasses = useCallback(async (signal?: AbortSignal) => {
		setClassesLoading(true);
		setClassesError(null);
		try {
			const classes = await apiRequest<PriceClassItem[]>("/price/classes", {
				signal,
			});
			if (signal?.aborted) return;
			setAllClasses(classes);

			// Populate filter dropdown from all class IDs
			const names = classes.map((c) => c.id).sort((a, b) => a.localeCompare(b));
			setPriceClassOptions(names);
		} catch (err: unknown) {
			if (signal?.aborted) return;
			setClassesError(
				err instanceof Error ? err.message : "Failed to fetch price classes",
			);
		} finally {
			if (!signal?.aborted) setClassesLoading(false);
		}
	}, []);

	useEffect(() => {
		const abort = new AbortController();
		fetchPriceClasses(abort.signal);
		return () => abort.abort();
	}, [fetchPriceClasses]);

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
	const fetchData = useCallback(
		async (signal?: AbortSignal) => {
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
				setWithoutPriceCount(res.withoutPriceCount);
			} catch (err: unknown) {
				if (signal?.aborted) return;
				setError(err instanceof Error ? err.message : "Failed to fetch prices");
			} finally {
				if (!signal?.aborted) {
					setLoading(false);
					setIsSearching(false);
				}
			}
		},
		[page, pageSize, searchQuery, unit],
	);

	useEffect(() => {
		const abort = new AbortController();
		fetchData(abort.signal);
		return () => abort.abort();
	}, [fetchData]);

	// ── Edit handlers ──────────────────────────────────────────────

	const handleStartEdit = (row: PriceRecord) => {
		setEditRowId(row.item_price_id ?? -1);
		setEditInventoryId(row.item_price_id != null ? null : row.inventory_id);
		setEditPrice(String(row.price ?? ""));
		setEditUnit(row.unit ?? "CS");
		setEditPriceClass(row.price_class ?? "");
	};

	const handleCancelEdit = () => {
		setEditRowId(null);
		setEditInventoryId(null);
		setEditPrice("");
		setEditUnit("");
		setEditPriceClass("");
	};

	const handleSaveEdit = async () => {
		setSaving(true);
		try {
			if (editRowId === -1 && editInventoryId) {
				// Creating new price — valid_from defaults to current datetime on server
				await apiRequest("/price/items", {
					method: "POST",
					body: {
						inventory_id: editInventoryId,
						price: Number(editPrice),
						unit: editUnit,
						price_class: editPriceClass,
					},
				});
			} else if (editRowId != null && editRowId > 0) {
				// Updating existing price
				await apiRequest(`/price/items/${editRowId}`, {
					method: "PUT",
					body: {
						price: Number(editPrice),
						unit: editUnit,
						price_class: editPriceClass,
					},
				});
			}
			handleCancelEdit();
			await fetchData();
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to save price");
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
				errCount > 0
					? `, ${errCount} Error(s): ${res.errors.map((e) => `Row ${e.row}: ${e.message}`).join("; ")}`
					: ""
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
			<PriceClassCard
				classes={allClasses}
				loading={classesLoading}
				error={classesError}
				onError={setClassesError}
				onRefresh={fetchPriceClasses}
			/>
			<Paper sx={{ width: "100%", mb: 2, overflow: "hidden" }}>
				<PricesToolbar
					searchInputValue={searchInputValue}
					onSearchInputChange={setSearchInputValue}
					handleSearch={handleSearch}
					handleKeyDown={handleKeyDown}
					clearSearch={clearSearch}
					isSearching={isSearching}
					totalCount={rowCount}
					withoutPriceCount={withoutPriceCount}
					unit={unit}
					unitOptions={unitOptions}
					onUnitChange={setUnit}
					onImportClick={() => setImportOpen(true)}
					priceClassOptions={priceClassOptions}
					selectedPriceClass={selectedPriceClass}
					onPriceClassChange={setSelectedPriceClass}
				/>
				{error ? (
					<Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>
						{error}
					</Alert>
				) : loading ? (
					<TableSkeleton
						cols={[
							{ icon: true },
							{},
							{},
							{},
							{ align: "right" },
							{},
							{},
							{ spacer: true },
							{ icon: true, align: "right" },
						]}
						rows={8}
					/>
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
											Price
										</TableCell>
										<TableCell sx={{ fontWeight: 600 }}>Unit</TableCell>
										<TableCell sx={{ fontWeight: 600 }}>Price Class</TableCell>
										<TableCell sx={{ width: 0, p: 0, textAlign: "right" }} />
										<TableCell
											sx={{ width: 48, px: 0.5, textAlign: "right" }}
										/>
									</TableRow>
								</TableHead>
								<TableBody>
									{rows.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={9}
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
												editPrice={editPrice}
												editUnit={editUnit}
												editPriceClass={editPriceClass}
												onStartEdit={handleStartEdit}
												onCancelEdit={handleCancelEdit}
												onSaveEdit={handleSaveEdit}
												onEditPriceChange={setEditPrice}
												onEditUnitChange={setEditUnit}
												onEditPriceClassChange={setEditPriceClass}
												priceClassOptions={priceClassOptions}
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
