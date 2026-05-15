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
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import apiRequest from "../services/api";

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
	// Display as short date
	const d = new Date(val);
	return d.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

// ── Row Component (collapsible) ──────────────────────────────────────

interface RowProps {
	row: PriceRecord;
}

const Row: React.FC<RowProps> = ({ row }) => {
	const [open, setOpen] = useState(false);
	const hasHistory = row.history.length > 0;

	return (
		<React.Fragment>
			<TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
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
				<TableCell sx={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
					{row.description ?? "—"}
				</TableCell>
				<TableCell align="right">{fmtNum(row.cost)}</TableCell>
				<TableCell>{row.unit ?? "—"}</TableCell>
				<TableCell>{row.price_class ?? "—"}</TableCell>
				<TableCell align="right">{row.pct_discount != null ? `${(row.pct_discount * 100).toFixed(1)}%` : "—"}</TableCell>
				<TableCell align="right" sx={{ fontWeight: 600 }}>
					{fmtNum(row.discount_price)}
				</TableCell>
			</TableRow>
			<TableRow>
				<TableCell
					sx={{ paddingBottom: 0, paddingTop: 0, borderBottom: open ? undefined : "unset" }}
					colSpan={9}
				>
					<Collapse in={open} timeout="auto" unmountOnExit>
						<Box sx={{ margin: 1 }}>
							<Typography variant="subtitle2" gutterBottom component="div" sx={{ color: "text.secondary" }}>
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
											<TableCell align="right">{fmtNum(h.discount_price)}</TableCell>
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
	priceClass: string | null;
	priceClassOptions: string[];
	onPriceClassChange: (value: string | null) => void;
	unit: string | null;
	unitOptions: string[];
	onUnitChange: (value: string | null) => void;
}

const PricesToolbar: React.FC<PricesToolbarProps> = ({
	searchInputValue,
	onSearchInputChange,
	handleSearch,
	handleKeyDown,
	clearSearch,
	isSearching,
	totalCount,
	priceClass,
	priceClassOptions,
	onPriceClassChange,
	unit,
	unitOptions,
	onUnitChange,
}) => (
	<Box
		sx={{
			display: "flex",
			flexDirection: { xs: "column", md: "row" },
			justifyContent: "space-between",
			alignItems: { xs: "stretch", md: "center" },
			gap: { xs: 1, md: 0 },
			px: 2,
			py: 1,
			borderBottom: "1px solid",
			borderColor: "divider",
		}}
	>
		<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
			<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
				Prices
			</Typography>
			<Typography variant="caption" sx={{ color: "text.secondary" }}>
				{totalCount} records
			</Typography>
		</Box>
		<Box
			sx={{
				display: "flex",
				alignItems: "center",
				gap: 1,
				flexWrap: "wrap",
				width: { xs: "100%", md: "auto" },
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
				options={priceClassOptions}
				value={priceClass}
				onChange={(_, newVal) => onPriceClassChange(newVal)}
				renderInput={(params) => (
					<TextField {...params} placeholder="Price Class" sx={{ minWidth: 160 }} />
				)}
				sx={{ minWidth: 160 }}
			/>
			<Autocomplete
				size="small"
				options={unitOptions}
				value={unit}
				onChange={(_, newVal) => onUnitChange(newVal)}
				renderInput={(params) => (
					<TextField {...params} placeholder="Unit" sx={{ minWidth: 100 }} />
				)}
				sx={{ minWidth: 100 }}
			/>
		</Box>
	</Box>
);

// ── Main Component ───────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 25;

const unitOptions = ["", "PCS", "CS", "BOX", "KG", "L", "M"];

const Prices: React.FC = () => {
	const [rows, setRows] = useState<PriceRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(0);
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
	const [rowCount, setRowCount] = useState(0);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInputValue, setSearchInputValue] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const searchTimeoutRef = useRef<number>(0);
	const [priceClass, setPriceClass] = useState<string | null>(null);
	const [priceClassOptions, setPriceClassOptions] = useState<string[]>([]);
	const [unit, setUnit] = useState<string | null>(null);

	const priceClassRef = useRef<string | null>(priceClass);
	const unitRef = useRef<string | null>(unit);

	useEffect(() => { priceClassRef.current = priceClass; }, [priceClass]);
	useEffect(() => { unitRef.current = unit; }, [unit]);

	// Commit search on Enter key or button click
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
	useEffect(() => {
		let cancelled = false;

		const fetchData = async () => {
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
				);
				if (!cancelled) {
					setRows(res.data);
					setRowCount(res.total);
				}
			} catch (err: unknown) {
				if (!cancelled) {
					setError(
						err instanceof Error ? err.message : "Failed to fetch prices",
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
					setIsSearching(false);
				}
			}
		};

		fetchData();
		return () => {
			cancelled = true;
		};
	}, [page, pageSize, searchQuery, priceClass, unit]);

	// Fetch price class options
	useEffect(() => {
		let cancelled = false;

		const fetchOptions = async () => {
			try {
				const res = await apiRequest<string[]>("/price/class");
				if (!cancelled) {
					setPriceClassOptions(res);
				}
			} catch {
				// non-critical
			}
		};

		fetchOptions();
		return () => { cancelled = true; };
	}, []);

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
				priceClass={priceClass}
				priceClassOptions={priceClassOptions}
				onPriceClassChange={setPriceClass}
				unit={unit}
				unitOptions={unitOptions}
				onUnitChange={setUnit}
			/>
			{error ? (
				<Alert severity="error" sx={{ m: 2 }}>
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
									<TableCell align="right" sx={{ fontWeight: 600 }}>Cost</TableCell>
									<TableCell sx={{ fontWeight: 600 }}>Unit</TableCell>
									<TableCell sx={{ fontWeight: 600 }}>Price Class</TableCell>
									<TableCell align="right" sx={{ fontWeight: 600 }}>Discount %</TableCell>
									<TableCell align="right" sx={{ fontWeight: 600 }}>Discount Price</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{rows.length === 0 ? (
									<TableRow>
										<TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>
											No prices found
										</TableCell>
									</TableRow>
								) : (
									rows.map((row) => (
										<Row key={row.inventory_id} row={row} />
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
		</Paper>
	);
};

export default Prices;
