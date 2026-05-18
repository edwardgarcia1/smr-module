import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
	valid_from?: string;
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
	pctDiscount: number | null;
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
	pctDiscount,
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
				<TableCell align="right" sx={{ minWidth: 120 }}>
					{pctDiscount != null && row.cost != null
						? fmtNum(row.cost * (1 - pctDiscount / 100))
						: "—"}
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
	withoutCostCount,
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
						<TextField {...params} placeholder="Price Class" sx={{ minWidth: 130 }} />
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
	id: number;
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
	const [className, setClassName] = useState("");
	const [discount, setDiscount] = useState("");
	const [validFrom, setValidFrom] = useState("");
	const [saving, setSaving] = useState(false);
	const [dialogError, setDialogError] = useState<string | null>(null);

	// Sync state when dialog opens with a different editItem
	// (useState initializer only runs once — useEffect handles subsequent opens)
	useEffect(() => {
		setClassName(isEdit ? editItem.price_class : "");
		setDiscount(isEdit ? String(editItem.pct_discount) : "");
		const now = new Date();
		const offset = now.getTimezoneOffset();
		const local = new Date(now.getTime() - offset * 60000);
		setValidFrom(local.toISOString().slice(0, 16));
		setDialogError(null);
	}, [open, isEdit, editItem]);

	const dialogKey = open
		? isEdit
			? `edit-${editItem.id}`
			: "add-new"
		: "closed";

	const handleSave = async () => {
		setDialogError(null);

		if (!className.trim()) {
			setDialogError("Price class name is required");
			return;
		}

		// Require an explicit discount value — empty string or whitespace-only is invalid
		if (!discount.trim()) {
			setDialogError("Discount is required. Enter 0 if no discount.");
			return;
		}

		const discountNum = Number(discount);
		if (!isFinite(discountNum) || isNaN(discountNum)) {
			setDialogError("Discount must be a valid number");
			return;
		}

		if (!validFrom) {
			setDialogError("Valid from date is required");
			return;
		}
		setSaving(true);

		// Current timestamp in MSSQL format (YYYY-MM-DD HH:MM:SS)
		const now = new Date().toISOString().slice(0, 19).replace("T", " ");

		// In edit mode, always use current timestamp for the new entry's valid_from
		const newValidFrom = isEdit
			? now
			: new Date(validFrom).toISOString().slice(0, 19).replace("T", " ");

		// Track whether we expired the old entry (for rollback)
		let expiredOld = false;
		const oldItem = isEdit ? editItem : null;

		try {
			if (isEdit && oldItem) {
				// Step 1: Expire the old price class by setting valid_to = now
				await apiRequest(
					`/price/classes/${oldItem.id}`,
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
			const msg = err instanceof Error ? err.message : "Failed to save price class";
			setDialogError(msg);
			// Also bubble up for parent-level logging if needed
			onError(msg);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog key={dialogKey} open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle>{isEdit ? "Edit Price Class" : "Add Price Class"}</DialogTitle>
			<DialogContent>
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
					{dialogError && (
						<Alert severity="error" onClose={() => setDialogError(null)} sx={{ mb: 1 }}>
							{dialogError}
						</Alert>
					)}
					<TextField
						label="Price Class"
						value={className}
						onChange={(e) => {
							setClassName(e.target.value);
							setDialogError(null);
						}}
						disabled={isEdit}
						size="small"
						required
					/>
					<TextField
						label="Discount %"
						type="number"
						value={discount}
						onChange={(e) => {
							setDiscount(e.target.value);
							setDialogError(null);
						}}
						size="small"
						required
						slotProps={{
							htmlInput: { step: "0.01" },
						}}
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
							onChange={(e) => {
								setValidFrom(e.target.value);
								setDialogError(null);
							}}
							size="small"
							slotProps={{ inputLabel: { shrink: true } }}
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

// ── PriceClass Row (collapsible with history) ──────────────────────

interface PriceClassRowProps {
	pc: PriceClassItem;
	history: PriceClassItem[];
	isFallback?: boolean;
	editingId: number | null;
	onEdit: (item: PriceClassItem) => void;
	onDelete: (item: PriceClassItem) => void;
	deleting: boolean;
}

const PriceClassRowComponent: React.FC<PriceClassRowProps> = ({
	pc,
	history,
	isFallback,
	editingId,
	onEdit,
	onDelete,
	deleting,
}) => {
	const [open, setOpen] = useState(false);
	const isEditing = editingId === pc.id;

	return (
		<React.Fragment>
			<TableRow
				selected={isEditing}
				sx={{
					"& > *": { borderBottom: "unset" },
					...(isFallback ? { opacity: 0.65, fontStyle: "italic" } : {}),
				}}
			>
				<TableCell sx={{ width: 48, px: 1 }}>
					<IconButton
						aria-label="expand row"
						size="small"
						onClick={() => setOpen(!open)}
						disabled={history.length === 0}
					>
						{history.length > 0 ? (
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
				<TableCell sx={{ fontWeight: 600 }}>
					<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
						{pc.price_class}
						{isFallback && (
							<Typography
								component="span"
								variant="caption"
								sx={{ color: "warning.main", fontWeight: 400, fontStyle: "italic" }}
							>
								(Expired)
							</Typography>
						)}
					</Box>
				</TableCell>
				<TableCell align="right">
					{pc.pct_discount.toLocaleString(undefined, {
						minimumFractionDigits: 2,
						maximumFractionDigits: 4,
					})}%
				</TableCell>
				<TableCell>{fmtDate(pc.valid_from)}</TableCell>
				<TableCell>
					{pc.valid_to ? fmtDate(pc.valid_to) : (
						<Typography component="span" variant="body2" sx={{ color: "success.main", fontWeight: 600 }}>
							Current
						</Typography>
					)}
				</TableCell>
				<TableCell align="right" sx={{ width: 100 }}>
					{!isFallback && (
						<IconButton
							size="small"
							onClick={() => onEdit(pc)}
							disabled={deleting}
							aria-label={`edit ${pc.price_class}`}
						>
							<EditIcon fontSize="small" />
						</IconButton>
					)}
					<IconButton
						size="small"
						onClick={() => onDelete(pc)}
						disabled={deleting}
						aria-label={`delete ${pc.price_class}`}
					>
						<DeleteIcon fontSize="small" />
					</IconButton>
				</TableCell>
			</TableRow>
			<TableRow>
				<TableCell
					sx={{
						paddingBottom: 0,
						paddingTop: 0,
						borderBottom: open ? undefined : "unset",
					}}
					colSpan={6}
				>
					<Collapse in={open} timeout="auto" unmountOnExit>
						<Box sx={{ margin: 1 }}>
							<Typography
								variant="subtitle2"
								gutterBottom
								component="div"
								sx={{ color: "text.secondary" }}
							>
								History
							</Typography>
							<Table size="small" aria-label="price class history">
								<TableHead>
									<TableRow>
										<TableCell>Valid From</TableCell>
										<TableCell>Valid To</TableCell>
										<TableCell align="right">Discount %</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{history.map((h, idx) => (
										<TableRow key={`${h.valid_from}__${idx}`}>
											<TableCell>{fmtDate(h.valid_from)}</TableCell>
											<TableCell>{fmtDate(h.valid_to)}</TableCell>
											<TableCell align="right">
												{h.pct_discount.toLocaleString(undefined, {
													minimumFractionDigits: 2,
													maximumFractionDigits: 4,
												})}%
											</TableCell>
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

// ── PriceClass Card ─────────────────────────────────────────────────

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
	const [deleteConfirmItem, setDeleteConfirmItem] = useState<PriceClassItem | null>(null);

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
				`/price/classes/${item.id}`,
				{ method: "DELETE" },
			);
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

	// Group entries by price_class: current (valid_to IS NULL) + history
	const groupedRows = useMemo(() => {
		const map = new Map<string, { current: PriceClassItem | null; history: PriceClassItem[] }>();
		for (const pc of classes) {
			const group = map.get(pc.price_class) ?? { current: null, history: [] };
			if (pc.valid_to === null) {
				group.current = pc;
			} else {
				group.history.push(pc);
			}
			map.set(pc.price_class, group);
		}
		// Sort history by valid_from DESC within each group
		for (const group of map.values()) {
			group.history.sort((a, b) => b.valid_from.localeCompare(a.valid_from));
		}
		return map;
	}, [classes]);

	// Array of rows sorted by price_class name
	const groupedArray = useMemo(() => {
		return Array.from(groupedRows.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([_, group]) => group);
	}, [groupedRows]);

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
								{groupedArray.length} {groupedArray.length === 1 ? "class" : "classes"}
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
				<Alert severity="error" sx={{ mx: 2, mb: 1 }} onClose={() => onError(null)}>
					{error}
				</Alert>
			)}

			{loading ? (
				<TableSkeleton
					cols={[
						{ icon: true },
						{},
						{ align: "right" },
						{},
						{},
						{ icon: true, align: "right" },
					]}
					rows={4}
				/>
			) : groupedArray.length === 0 ? (
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
								<TableCell sx={{ width: 48, px: 1 }} />
								<TableCell>Price Class</TableCell>
								<TableCell align="right">Discount %</TableCell>
								<TableCell>Valid From</TableCell>
								<TableCell>Valid To</TableCell>
								<TableCell align="right" sx={{ width: 100 }}>
									Actions
								</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{groupedArray.map(({ current, history }) => {
								// Fallback: if no current entry exists, use the most recent history entry as the row
								const displayRow = current ?? history[0] ?? null;
								if (!displayRow) return null;
								// When using a fallback, exclude that entry from the history sub-table
								const displayHistory = current
									? history
									: history.filter((h) => h.id !== displayRow.id);
								return (
									<PriceClassRowComponent
										key={displayRow.price_class}
										pc={displayRow}
										history={displayHistory}
										isFallback={!current}
										editingId={editItem?.id ?? null}
										onEdit={handleEdit}
										onDelete={handleDelete}
										deleting={deleting}
									/>
								);
							})}
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

// ── Table Skeleton ─────────────────────────────────────────────────

interface SkeletonCol {
	/** Column alignment. Defaults to 'left'. */
	align?: "left" | "right" | "center";
	/** When true, renders a narrow fixed-width skeleton (icon/button columns). */
	icon?: boolean;
	/** When true, renders an empty cell (zero-width spacer columns). */
	spacer?: boolean;
}

/** Deterministic pseudo-random width (40‑90%) based on row/col indices. */
function skelWidthPct(row: number, col: number): number {
	return 40 + ((row * 7 + col * 13 + col * 3) % 51);
}

const TableSkeleton: React.FC<{ cols: SkeletonCol[]; rows?: number }> = ({ cols, rows = 5 }) => (
	<TableContainer>
		<Table size="small">
			<TableBody>
				{Array.from({ length: rows }, (_, i) => (
					<TableRow key={i}>
						{cols.map((col, j) =>
							col.spacer ? (
								<TableCell key={j} sx={{ p: 0, width: 0, borderBottom: "unset" }} />
							) : col.icon ? (
								<TableCell key={j} sx={{ width: 48, px: 1, textAlign: col.align ?? "left" }}>
									<Skeleton animation="wave" variant="circular" width={20} height={20} />
								</TableCell>
							) : (
								<TableCell key={j} sx={{ textAlign: col.align ?? "left" }}>
									<Skeleton
										animation="wave"
										variant="text"
										sx={{ width: `${skelWidthPct(i, j)}%`, maxWidth: 120, display: "inline-block" }}
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
	const [withoutCostCount, setWithoutCostCount] = useState(0);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInputValue, setSearchInputValue] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const searchTimeoutRef = useRef<number>(0);
	const [unit, setUnit] = useState<string | null>(null);

	// Price class filter state
	const [priceClassOptions, setPriceClassOptions] = useState<string[]>([]);
	const [selectedPriceClass, setSelectedPriceClass] = useState<string | null>(null);
	const [selectedPctDiscount, setSelectedPctDiscount] = useState<number | null>(null);

	// Shared full classes data (for PriceClassCard + filter derivation)
	const [allClasses, setAllClasses] = useState<PriceClassItem[]>([]);
	const [classesLoading, setClassesLoading] = useState(true);
	const [classesError, setClassesError] = useState<string | null>(null);

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

	// Single fetch for price classes: populates filter, discount map, and PriceClassCard data
	const discountMapRef = useRef<Map<string, number>>(new Map());
	const fetchPriceClasses = useCallback(async (signal?: AbortSignal) => {
		setClassesLoading(true);
		setClassesError(null);
		try {
			const classes = await apiRequest<PriceClassItem[]>(
				"/price/classes",
				{ signal },
			);
			if (signal?.aborted) return;
			setAllClasses(classes);

			const active = classes.filter((c) => c.valid_to === null);
			// Populate filter dropdown options
			const names = [...new Set(active.map((c) => c.price_class))].sort((a, b) => a.localeCompare(b));
			setPriceClassOptions(names);
			// Build discount lookup map
			const map = new Map<string, number>();
			for (const c of active) {
				map.set(c.price_class, c.pct_discount);
			}
			discountMapRef.current = map;
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
				withoutCostCount={withoutCostCount}
				unit={unit}
				unitOptions={unitOptions}
				onUnitChange={setUnit}
				onImportClick={() => setImportOpen(true)}
				priceClassOptions={priceClassOptions}
				selectedPriceClass={selectedPriceClass}
				onPriceClassChange={(val) => {
					setSelectedPriceClass(val);
					if (!val) {
						setSelectedPctDiscount(null);
					} else {
						setSelectedPctDiscount(discountMapRef.current.get(val) ?? null);
					}
				}}
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
						{ align: "right" },
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
										Cost
									</TableCell>
									<TableCell align="right" sx={{ fontWeight: 600 }}>
										Discounted
									</TableCell>
									<TableCell sx={{ fontWeight: 600 }}>Unit</TableCell>
								<TableCell sx={{ width: 0, p: 0, textAlign: "right" }} />
								<TableCell sx={{ width: 48, px: 0.5, textAlign: "right" }} />
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
											editCost={editCost}
											editUnit={editUnit}
											onStartEdit={handleStartEdit}
											onCancelEdit={handleCancelEdit}
											onSaveEdit={handleSaveEdit}
											onEditCostChange={setEditCost}
											onEditUnitChange={setEditUnit}
											saving={saving}
											pctDiscount={selectedPctDiscount}
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
