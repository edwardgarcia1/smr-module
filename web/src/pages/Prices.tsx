import React, {
	useState,
	useEffect,
	useCallback,
	useRef,
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
	Chip,
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
import HistoryIcon from "@mui/icons-material/History";
import apiRequest from "../services/api";
import * as XLSX from "xlsx";
import Big from "big.js";

// ── Types matching refactored price.schema.ts ─────────────────────────

interface PriceHistoryEntry {
	valid_from: string;
	valid_to: string | null;
	price: number;
	unit: string;
	price_class: string;
}

interface PriceClassEntry {
	item_price_id: number;
	price: number;
	unit: string;
	price_class: string;
}

interface PriceRecord {
	inventory_id: string;
	class_id: string | null;
	description: string | null;
	prices: PriceClassEntry[];
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

interface Principal {
	ClassID: string;
	Descr: string;
	User5: string;
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

// ── History Dialog ────────────────────────────────────────────────────

interface HistoryDialogProps {
	open: boolean;
	onClose: () => void;
	inventoryId: string;
	history: PriceHistoryEntry[];
}

const HistoryDialog: React.FC<HistoryDialogProps> = ({
	open,
	onClose,
	inventoryId,
	history,
}) => (
	<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
		<DialogTitle>Price History — {inventoryId}</DialogTitle>
		<DialogContent>
			{history.length === 0 ? (
				<Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>
					No historical entries for this item.
				</Typography>
			) : (
				<TableContainer sx={{ maxHeight: 400 }}>
					<Table size="small" stickyHeader>
						<TableHead>
							<TableRow>
								<TableCell sx={{ fontWeight: 600 }}>Price Class</TableCell>
								<TableCell align="right" sx={{ fontWeight: 600 }}>Price</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Unit</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Valid From</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Valid To</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{history.map((h, idx) => (
								<TableRow key={`${h.price_class}__${h.valid_from}__${idx}`}>
									<TableCell>
										<Chip label={h.price_class} size="small" variant="outlined" />
									</TableCell>
									<TableCell align="right">{fmtNum(h.price)}</TableCell>
									<TableCell>{h.unit}</TableCell>
									<TableCell>{fmtDate(h.valid_from)}</TableCell>
									<TableCell>{fmtDate(h.valid_to)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			)}
		</DialogContent>
		<DialogActions>
			<Button onClick={onClose}>Close</Button>
		</DialogActions>
	</Dialog>
);

// ── Add/Edit Price Dialog ─────────────────────────────────────────────

interface PriceFormDialogProps {
	open: boolean;
	onClose: () => void;
	onSaved: () => Promise<void>;
	inventoryId: string;
	editEntry: PriceClassEntry | null; // null = add mode
	priceClassOptions: string[];
}

const PriceFormDialog: React.FC<PriceFormDialogProps> = ({
	open,
	onClose,
	onSaved,
	inventoryId,
	editEntry,
	priceClassOptions,
}) => {
	const isEdit = editEntry != null;
	const [priceClass, setPriceClass] = useState("");
	const [price, setPrice] = useState("");
	const [unit, setUnit] = useState("CS");
	const [saving, setSaving] = useState(false);
	const [dialogError, setDialogError] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setPriceClass(isEdit ? editEntry.price_class : "");
			setPrice(isEdit ? String(editEntry.price) : "");
			setUnit(isEdit ? editEntry.unit : "CS");
			setDialogError(null);
		}
	}, [open, isEdit, editEntry]);

	const handleSave = async () => {
		setDialogError(null);

		if (!priceClass.trim()) {
			setDialogError("Price class is required");
			return;
		}
		const priceNum = Number(price);
		if (!price || isNaN(priceNum) || !isFinite(priceNum)) {
			setDialogError("Valid price is required");
			return;
		}
		if (!unit.trim()) {
			setDialogError("Unit is required");
			return;
		}

		setSaving(true);
		try {
			if (isEdit && editEntry) {
				// Update existing — PUT expires old and creates new
				await apiRequest(`/price/items/${editEntry.item_price_id}`, {
					method: "PUT",
					body: { price: priceNum, unit, price_class: priceClass.trim() },
				});
			} else {
				// Create new
				await apiRequest("/price/items", {
					method: "POST",
					body: {
						inventory_id: inventoryId,
						price: priceNum,
						unit: unit.trim(),
						price_class: priceClass.trim(),
					},
				});
			}
			await onSaved();
			onClose();
		} catch (err: unknown) {
			const msg =
				err instanceof Error ? err.message : "Failed to save price";
			setDialogError(msg);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle>
				{isEdit ? "Edit Price" : "Add Price"} — {inventoryId}
			</DialogTitle>
			<DialogContent>
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
					{dialogError && (
						<Alert severity="error" onClose={() => setDialogError(null)}>
							{dialogError}
						</Alert>
					)}
					<Autocomplete
						size="small"
						freeSolo
						options={priceClassOptions}
						value={priceClass}
						onChange={(_, newVal) => setPriceClass(newVal ?? "")}
						onInputChange={(_, newVal) => setPriceClass(newVal)}
						renderInput={(params) => (
							<TextField
								{...params}
								label="Price Class"
								required
							/>
						)}
						disabled={isEdit}
					/>
					<TextField
						label="Price"
						type="number"
						value={price}
						onChange={(e) => setPrice(e.target.value)}
						size="small"
						required
						slotProps={{ htmlInput: { step: "0.01" } }}
					/>
					<Select
						size="small"
						value={unit}
						onChange={(e) => setUnit(e.target.value)}
						required
					>
						{unitOptions.map((u) => (
							<MenuItem key={u} value={u}>
								{u}
							</MenuItem>
						))}
					</Select>
				</Box>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose} disabled={saving}>
					Cancel
				</Button>
				<Button variant="contained" onClick={handleSave} disabled={saving}>
					{saving ? "Saving..." : isEdit ? "Update" : "Add"}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

// ── Row Component (one per inventory_id) ─────────────────────────────

interface RowProps {
	row: PriceRecord;
	priceClassOptions: string[];
	onRefresh: () => Promise<void>;
	setGlobalError: (msg: string) => void;
}

const RowComponent: React.FC<RowProps> = ({
	row,
	priceClassOptions,
	onRefresh,
	setGlobalError,
}) => {
	const [open, setOpen] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [formOpen, setFormOpen] = useState(false);
	const [editEntry, setEditEntry] = useState<PriceClassEntry | null>(null);
	const [deletingPriceId, setDeletingPriceId] = useState<number | null>(null);

	const hasPrices = row.prices.length > 0;
	const hasHistory = row.history.length > 0;

	const handleDeletePrice = async (entry: PriceClassEntry) => {
		setDeletingPriceId(entry.item_price_id);
		try {
			await apiRequest(`/price/items/${entry.item_price_id}`, {
				method: "DELETE",
			});
			await onRefresh();
		} catch (err: unknown) {
			setGlobalError(
				err instanceof Error ? err.message : "Failed to delete price",
			);
		} finally {
			setDeletingPriceId(null);
		}
	};

	const handleAddPrice = () => {
		setEditEntry(null);
		setFormOpen(true);
	};

	const handleEditPrice = (entry: PriceClassEntry) => {
		setEditEntry(entry);
		setFormOpen(true);
	};

	return (
		<React.Fragment>
			<TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
				<TableCell sx={{ width: 48, px: 1 }}>
					<IconButton
						aria-label="expand row"
						size="small"
						onClick={() => setOpen(!open)}
						disabled={!hasPrices && !hasHistory}
					>
						{hasPrices || hasHistory ? (
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
						maxWidth: 300,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{row.description ?? "—"}
				</TableCell>
				<TableCell sx={{ minWidth: 180 }}>
					<Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
						{hasPrices ? (
							row.prices.map((p) => (
								<Chip
									key={p.item_price_id}
									label={`${p.price_class}: ${fmtNum(p.price)}/${p.unit}`}
									size="small"
									color="primary"
									variant="outlined"
								/>
							))
						) : (
							<Typography variant="caption" sx={{ color: "text.secondary" }}>
								No prices
							</Typography>
						)}
					</Box>
				</TableCell>
				<TableCell sx={{ whiteSpace: "nowrap" }}>
					<Box sx={{ display: "flex", gap: 0.5 }}>
						<IconButton
							size="small"
							onClick={() => setHistoryOpen(true)}
							disabled={!hasHistory}
							aria-label="view history"
							title="View history"
						>
							<HistoryIcon fontSize="small" />
						</IconButton>
						<IconButton
							size="small"
							onClick={handleAddPrice}
							aria-label="add price"
							title="Add price"
						>
							<AddIcon fontSize="small" />
						</IconButton>
					</Box>
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
							{/* Current Prices */ }
							<Typography
								variant="subtitle2"
								gutterBottom
								component="div"
								sx={{ color: "text.secondary" }}
							>
								Current Prices
							</Typography>
							{hasPrices ? (
								<Table size="small" aria-label="current prices">
									<TableHead>
										<TableRow>
											<TableCell sx={{ fontWeight: 600 }}>Price Class</TableCell>
											<TableCell align="right" sx={{ fontWeight: 600 }}>Price</TableCell>
											<TableCell sx={{ fontWeight: 600 }}>Unit</TableCell>
											<TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{row.prices.map((p) => (
											<TableRow key={p.item_price_id}>
												<TableCell>{p.price_class}</TableCell>
												<TableCell align="right">{fmtNum(p.price)}</TableCell>
												<TableCell>{p.unit}</TableCell>
												<TableCell align="right">
													<IconButton
														size="small"
														onClick={() => handleEditPrice(p)}
														aria-label={`edit ${p.price_class}`}
													>
														<EditIcon fontSize="small" />
													</IconButton>
													<IconButton
														size="small"
														onClick={() => handleDeletePrice(p)}
														disabled={deletingPriceId === p.item_price_id}
														aria-label={`delete ${p.price_class}`}
													>
														<DeleteIcon fontSize="small" />
													</IconButton>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							) : (
								<Typography
									variant="body2"
									sx={{ color: "text.secondary", py: 1 }}
								>
									No current prices. Click "+" to add one.
								</Typography>
							)}
						</Box>
					</Collapse>
				</TableCell>
			</TableRow>

			{/* History Dialog */}
			<HistoryDialog
				open={historyOpen}
				onClose={() => setHistoryOpen(false)}
				inventoryId={row.inventory_id}
				history={row.history}
			/>

			{/* Add/Edit Price Dialog */}
			<PriceFormDialog
				open={formOpen}
				onClose={() => setFormOpen(false)}
				onSaved={onRefresh}
				inventoryId={row.inventory_id}
				editEntry={editEntry}
				priceClassOptions={priceClassOptions}
			/>
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
	principals: Principal[];
	selectedPrincipal: Principal | null;
	onPrincipalChange: (value: Principal | null) => void;
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
	principals,
	selectedPrincipal,
	onPrincipalChange,
}) => (
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
				placeholder="Search inventory ID or description..."
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
				options={principals}
				value={selectedPrincipal}
				onChange={(_, newVal) => onPrincipalChange(newVal)}
				getOptionLabel={(option) => `${option.ClassID} — ${option.Descr}`}
				isOptionEqualToValue={(option, val) => option.ClassID === val.ClassID}
				renderInput={(params) => (
					<TextField
						{...params}
						placeholder="Principal (Class ID)"
						sx={{ minWidth: 220 }}
					/>
				)}
				sx={{ minWidth: 220 }}
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
	editItem: PriceClassItem | null;
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

// ── PriceClass Row ──────────────────────────────────────────────────

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

// ── PriceClass Card ────────────────────────────────────────────────

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

	// Principal filter state
	const [principals, setPrincipals] = useState<Principal[]>([]);
	const [selectedPrincipal, setSelectedPrincipal] = useState<Principal | null>(
		null,
	);

	// Shared full classes data (for PriceClassCard + filter derivation)
	const [allClasses, setAllClasses] = useState<PriceClassItem[]>([]);
	const [classesLoading, setClassesLoading] = useState(true);
	const [classesError, setClassesError] = useState<string | null>(null);

	const unitRef = useRef<string | null>(unit);

	// Import state
	const [importOpen, setImportOpen] = useState(false);
	const [importing, setImporting] = useState(false);
	const [importResult, setImportResult] = useState<string | null>(null);

	useEffect(() => {
		unitRef.current = unit;
	}, [unit]);

	const fetchPriceClasses = useCallback(async (signal?: AbortSignal) => {
		setClassesLoading(true);
		setClassesError(null);
		try {
			const classes = await apiRequest<PriceClassItem[]>("/price/classes", {
				signal,
			});
			if (signal?.aborted) return;
			setAllClasses(classes);

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

	const fetchPrincipals = useCallback(async () => {
		try {
			const list = await apiRequest<Principal[]>("/principal/ids");
			setPrincipals(list ?? []);
		} catch {
			/* non-critical */
		}
	}, []);

	useEffect(() => {
		const abort = new AbortController();
		fetchPriceClasses(abort.signal);
		return () => abort.abort();
	}, [fetchPriceClasses]);

	useEffect(() => {
		fetchPrincipals();
	}, [fetchPrincipals]);

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
				if (selectedPrincipal) params.set("classID", selectedPrincipal.ClassID);

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
		[page, pageSize, searchQuery, unit, selectedPrincipal],
	);

	useEffect(() => {
		const abort = new AbortController();
		fetchData(abort.signal);
		return () => abort.abort();
	}, [fetchData]);

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

	// ── Import handler ────────────────────────────────────────────

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
					onImportClick={() => {
						setImportOpen(true);
						setImportResult(null);
					}}
					principals={principals}
					selectedPrincipal={selectedPrincipal}
					onPrincipalChange={(val) => {
						setSelectedPrincipal(val);
						setPage(0);
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
							{},
							{ icon: true, align: "right" },
						]}
						rows={8}
					/>
				) : (
					<>
						<TableContainer>
							<Table aria-label="price table grouped by inventory" size="small">
								<TableHead>
									<TableRow>
										<TableCell sx={{ width: 48, px: 1 }} />
										<TableCell sx={{ fontWeight: 600 }}>Inventory ID</TableCell>
										<TableCell sx={{ fontWeight: 600 }}>Class ID</TableCell>
										<TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
										<TableCell sx={{ fontWeight: 600 }}>Prices</TableCell>
										<TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{rows.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												align="center"
												sx={{ py: 4, color: "text.secondary" }}
											>
												No prices found
											</TableCell>
										</TableRow>
									) : (
										rows.map((row) => (
											<RowComponent
												key={row.inventory_id}
												row={row}
												priceClassOptions={priceClassOptions}
												onRefresh={fetchData}
												setGlobalError={setError}
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
