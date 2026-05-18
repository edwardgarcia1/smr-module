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
	DialogActions,
	FormControl,
	InputLabel,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import UploadIcon from "@mui/icons-material/Upload";
import apiRequest from "../services/api";
import * as XLSX from "xlsx";

// ── Types matching price.schema.ts response ──────────────────────────

interface PriceHistoryEntry {
	valid_from: string;
	valid_to: string | null;
	cost: number;
	unit: string;
	price_class: string | null;
	discount_price: number | null;
}

interface PriceRecord {
	item_cost_id: number | null;
	inventory_id: string;
	class_id: string | null;
	description: string | null;
	cost: number | null;
	unit: string | null;
	price_class: string | null;
	pct_discount: number | null;
	discount_price: number | null;
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

const unitOptions = ["PCS", "CS", "BOX", "KG", "L", "M"];

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
						maxWidth: 220,
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
				<TableCell>{row.price_class ?? "—"}</TableCell>
				<TableCell align="right">
					{row.pct_discount != null
						? `${(row.pct_discount * 100).toFixed(1)}%`
						: "—"}
				</TableCell>
				<TableCell align="right" sx={{ fontWeight: 600 }}>
					{fmtNum(row.discount_price)}
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
					colSpan={11}
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
										<TableCell>Price Class</TableCell>
										<TableCell align="right">Discount Price</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{row.history.map((h, idx) => (
										<TableRow key={`${h.valid_from}__${idx}`}>
											<TableCell>{fmtDate(h.valid_from)}</TableCell>
											<TableCell>{fmtDate(h.valid_to)}</TableCell>
											<TableCell align="right">{fmtNum(h.cost)}</TableCell>
											<TableCell>{h.unit}</TableCell>
											<TableCell>{h.price_class ?? "—"}</TableCell>
											<TableCell align="right">
												{fmtNum(h.discount_price)}
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
	priceClass: string | null;
	priceClassOptions: string[];
	onPriceClassChange: (value: string | null) => void;
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
	priceClass,
	priceClassOptions,
	onPriceClassChange,
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
				options={priceClassOptions}
				value={priceClass}
				onChange={(_, newVal) => onPriceClassChange(newVal)}
				renderInput={(params) => (
					<TextField {...params} placeholder="Price Class" sx={{ minWidth: 140 }} />
				)}
				sx={{ minWidth: 140 }}
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
	const [priceClass, setPriceClass] = useState<string | null>(null);
	const [priceClassOptions, setPriceClassOptions] = useState<string[]>([]);
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

	const priceClassRef = useRef<string | null>(priceClass);
	const unitRef = useRef<string | null>(unit);

	useEffect(() => {
		priceClassRef.current = priceClass;
	}, [priceClass]);
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
			const pc = priceClassRef.current;
			if (pc) params.set("price_class", pc);
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
	}, [page, pageSize, searchQuery, priceClass, unit]);

	useEffect(() => {
		const abort = new AbortController();
		fetchData(abort.signal);
		return () => abort.abort();
	}, [fetchData]);

	// Fetch price class options
	useEffect(() => {
		let cancelled = false;
		const fetchOptions = async () => {
			try {
				const res = await apiRequest<string[]>("/price/class");
				if (!cancelled) setPriceClassOptions(res);
			} catch {
				// non-critical
			}
		};
		fetchOptions();
		return () => {
			cancelled = true;
		};
	}, []);

	// ── Edit handlers ──────────────────────────────────────────────

	const handleStartEdit = (row: PriceRecord) => {
		setEditRowId(row.item_cost_id ?? -1); // -1 means "new"
		setEditInventoryId(row.item_cost_id != null ? null : row.inventory_id);
		setEditCost(String(row.cost ?? ""));
		setEditUnit(row.unit ?? "PCS");
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
				priceClass={priceClass}
				priceClassOptions={priceClassOptions}
				onPriceClassChange={setPriceClass}
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
									<TableCell sx={{ fontWeight: 600 }}>Price Class</TableCell>
									<TableCell align="right" sx={{ fontWeight: 600 }}>
										Discount %
									</TableCell>
									<TableCell align="right" sx={{ fontWeight: 600 }}>
										Discount Price
									</TableCell>
									<TableCell sx={{ width: 48, px: 0.5 }} />
								</TableRow>
							</TableHead>
							<TableBody>
								{rows.length === 0 ? (
									<TableRow>
										<TableCell
					colSpan={11}
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
	);
};

export default Prices;
