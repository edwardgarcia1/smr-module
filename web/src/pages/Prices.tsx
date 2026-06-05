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
	Chip,
	Alert,
	Button,
	Select,
	MenuItem,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import apiRequest from "../services/api";
import TableSkeleton from "../components/TableSkeleton";
import PricesToolbar from "../components/prices/PricesToolbar";
import HistoryDialog from "../components/prices/HistoryDialog";
import ImportDialog from "../components/prices/ImportDialog";
import PriceClassesDialog from "../components/prices/PriceClassesDialog";
import {
	fmtNum,
	fmtDate,
	UNIT_OPTIONS,
	type PriceRecord,
	type PriceClassEntry,
	type PriceHistoryEntry,
	type ImportRow,
	type Principal,
	type PaginatedResponse,
} from "../config/prices";

// ── Add/Edit Price Dialog ─────────────────────────────────────────────

interface PriceFormDialogProps {
	open: boolean;
	onClose: () => void;
	onSaved: () => Promise<void>;
	inventoryId: string;
	editEntry: PriceClassEntry | null;
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
				await apiRequest(`/price/items/${editEntry.item_price_id}`, {
					method: "PUT",
					body: { price: priceNum, unit, price_class: priceClass.trim() },
				});
			} else {
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
			const msg = err instanceof Error ? err.message : "Failed to save price";
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
							<TextField {...params} label="Price Class" required />
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
						{UNIT_OPTIONS.map((u) => (
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
	setGlobalError: (msg: string | null) => void;
}

const RowComponent: React.FC<RowProps> = ({
	row,
	priceClassOptions,
	onRefresh,
	setGlobalError,
}) => {
	const [expanded, setExpanded] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [formOpen, setFormOpen] = useState(false);
	const [editEntry, setEditEntry] = useState<PriceClassEntry | null>(null);

	return (
		<>
			<TableRow
				sx={{ "& > *": { borderBottom: "unset" }, cursor: "pointer" }}
				hover
				onClick={() => setExpanded(!expanded)}
			>
				<TableCell sx={{ width: 48, px: 1 }}>
					<IconButton
						size="small"
						onClick={() => setExpanded(!expanded)}
						aria-label="expand row"
					>
						{expanded ? (
							<KeyboardArrowUpIcon fontSize="small" />
						) : (
							<KeyboardArrowDownIcon fontSize="small" />
						)}
					</IconButton>
				</TableCell>
				<TableCell sx={{ fontWeight: 600 }}>{row.inventory_id}</TableCell>
				<TableCell>{row.class_id ?? "—"}</TableCell>
				<TableCell
					sx={{
						maxWidth: 250,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{row.description ?? "—"}
				</TableCell>
				<TableCell>
					<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
						{row.prices.map((p, idx) => (
							<Chip
								key={`${p.price_class}__${idx}`}
								label={`${p.price_class}: ${fmtNum(p.price)}`}
								size="small"
								variant="outlined"
							/>
						))}
						{row.prices.length === 0 && (
							<Typography variant="caption" sx={{ color: "text.disabled" }}>
								No prices set
							</Typography>
						)}
					</Box>
				</TableCell>
				<TableCell align="right" sx={{ width: 100 }}>
					<IconButton
						size="small"
						onClick={(e) => {
							e.stopPropagation();
							setEditEntry(null);
							setFormOpen(true);
						}}
						aria-label="add price"
					>
						<EditIcon fontSize="small" />
					</IconButton>
					<IconButton
						size="small"
						onClick={(e) => {
							e.stopPropagation();
							setHistoryOpen(true);
						}}
						aria-label="price history"
					>
						<HistoryIcon fontSize="small" />
					</IconButton>
				</TableCell>
			</TableRow>
			<TableRow>
				<TableCell
					colSpan={6}
					style={{ paddingBottom: 0, paddingTop: 0 }}
				>
					<Collapse in={expanded} timeout="auto" unmountOnExit>
						<Box sx={{ py: 1.5, px: 2 }}>
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell sx={{ fontWeight: 600 }}>Price Class</TableCell>
										<TableCell align="right" sx={{ fontWeight: 600 }}>
											Price
										</TableCell>
										<TableCell sx={{ fontWeight: 600 }}>Unit</TableCell>
										<TableCell sx={{ fontWeight: 600 }}>Valid From</TableCell>
										<TableCell sx={{ fontWeight: 600 }}>Valid To</TableCell>
										<TableCell sx={{ fontWeight: 600 }}>Encoded By</TableCell>
										<TableCell sx={{ fontWeight: 600 }} align="right">
											Actions
										</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{row.prices.map((p, idx) => (
										<TableRow key={`${p.item_price_id}__${idx}`}>
											<TableCell>
												<Chip
													label={p.price_class}
													size="small"
													variant="outlined"
												/>
											</TableCell>
											<TableCell align="right">{fmtNum(p.price)}</TableCell>
											<TableCell>{p.unit}</TableCell>
											<TableCell>{fmtDate(p.valid_from)}</TableCell>
											<TableCell>{fmtDate(p.valid_to)}</TableCell>
											<TableCell>{p.encoded_by}</TableCell>
											<TableCell align="right">
												<IconButton
													size="small"
													onClick={() => {
														setEditEntry(p);
														setFormOpen(true);
													}}
												>
													<EditIcon fontSize="small" />
												</IconButton>
											</TableCell>
										</TableRow>
									))}
									{row.prices.length === 0 && (
										<TableRow>
											<TableCell
												colSpan={7}
												align="center"
												sx={{ color: "text.disabled", py: 2 }}
											>
												No prices for this item.
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</Box>
					</Collapse>
				</TableCell>
			</TableRow>

			<PriceFormDialog
				open={formOpen}
				onClose={() => setFormOpen(false)}
				onSaved={onRefresh}
				inventoryId={row.inventory_id}
				editEntry={editEntry}
				priceClassOptions={priceClassOptions}
			/>

			<HistoryDialog
				open={historyOpen}
				onClose={() => setHistoryOpen(false)}
				inventoryId={row.inventory_id}
				history={row.history}
			/>
		</>
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
	const [allClasses, setAllClasses] = useState<
		{ id: string; description: string | null; created_by: string }[]
	>([]);
	const [classesLoading, setClassesLoading] = useState(true);
	const [classesError, setClassesError] = useState<string | null>(null);

	const unitRef = useRef<string | null>(unit);

	// Import state
	const [importOpen, setImportOpen] = useState(false);
	const [importing, setImporting] = useState(false);
	const [importResult, setImportResult] = useState<string | null>(null);

	// Price Classes dialog state
	const [priceClassesOpen, setPriceClassesOpen] = useState(false);

	useEffect(() => {
		unitRef.current = unit;
	}, [unit]);

	const fetchPriceClasses = useCallback(async (signal?: AbortSignal) => {
		setClassesLoading(true);
		setClassesError(null);
		try {
			const classes = await apiRequest<
				{ id: string; description: string | null; created_by: string }[]
			>("/price/classes", { signal });
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
				if (selectedPrincipal)
					params.set("classID", selectedPrincipal.ClassID);

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
				setError(
					err instanceof Error ? err.message : "Failed to fetch prices",
				);
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
		<Box
			sx={{
				height: "calc(100dvh - 130px)",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				width: "100%",
			}}
		>
			<Paper
				sx={{
					flex: 1,
					overflow: "hidden",
					display: "flex",
					flexDirection: "column",
					borderRadius: 2,
				}}
			>
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
					onUnitChange={setUnit}
					onImportClick={() => {
						setImportOpen(true);
						setImportResult(null);
					}}
					onPriceClassesClick={() => setPriceClassesOpen(true)}
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
					<Box sx={{ flex: 1, overflow: "auto" }}>
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
					</Box>
				) : (
					<>
						<TableContainer sx={{ flex: 1, overflow: "auto" }}>
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
							sx={{ flexShrink: 0 }}
						/>
					</>
				)}
			</Paper>
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
			<PriceClassesDialog
				open={priceClassesOpen}
				onClose={() => setPriceClassesOpen(false)}
				classes={allClasses}
				loading={classesLoading}
				error={classesError}
				onError={setClassesError}
				onRefresh={fetchPriceClasses}
			/>
		</Box>
	);
};

export default Prices;
