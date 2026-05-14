import React, { useState, useEffect, useCallback, useRef } from "react";
import {
	Box,
	Paper,
	Alert,
	TextField,
	Autocomplete,
	InputAdornment,
	IconButton,
	Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import FilterListIcon from "@mui/icons-material/FilterList";
import {
	DataGrid,
	ColumnsPanelTrigger,
	FilterPanelTrigger,
	type GridColDef,
	type GridPaginationModel,
} from "@mui/x-data-grid";
import apiRequest from "../services/api";

// ── Types matching price.schema.ts ────────────────────────────────────

interface SlsPrcWithDet {
	SlsPrcID: string;
	InvtID: string;
	CatalogNbr: string;
	Descr: string | null;
	DiscPrice: number | null;
	SlsUnit: string | null;
	_id: string;
}

interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

// ── Constants ─────────────────────────────────────────────────────────
// Community edition limited to 100 rows per page
const DEFAULT_PAGE_SIZE = 100;

// ─── Toolbar Component (standalone — stable reference prevents remount) ─

interface PricesToolbarProps {
	searchInputValue: string;
	onSearchInputChange: (value: string) => void;
	handleSearch: () => void;
	handleKeyDown: (e: React.KeyboardEvent) => void;
	clearSearch: () => void;
	isSearching: boolean;
	priceClassID: string | null;
	priceClassOptions: string[];
	onPriceClassIDChange: (value: string | null) => void;
}

const PricesToolbar: React.FC<PricesToolbarProps> = ({
	searchInputValue,
	onSearchInputChange,
	handleSearch,
	handleKeyDown,
	clearSearch,
	isSearching,
	priceClassID,
	priceClassOptions,
	onPriceClassIDChange,
}) => {
	const iconSx = {
		minWidth: "auto",
		textTransform: "none",
		fontSize: "0.8125rem",
		fontWeight: 500,
		paddingLeft: 0.75,
		paddingRight: 0.75,
	};
	return (
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
			<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
				Prices
			</Typography>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 1,
					width: { xs: "100%", md: "auto" },
				}}
			>
				<TextField
					size="small"
					placeholder="Search prices... (Enter to search)"
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
						minWidth: { xs: 0, md: 240 },
					}}
				/>
				<Autocomplete
					size="small"
					options={priceClassOptions}
					value={priceClassID}
					onChange={(_, newVal) => onPriceClassIDChange(newVal)}
					renderInput={(params) => (
						<TextField
							{...params}
							placeholder="Price Class"
							sx={{ minWidth: 180, maxWidth: 240 }}
						/>
					)}
					sx={{ minWidth: 180 }}
				/>
				<FilterPanelTrigger
					size="small"
					startIcon={<FilterListIcon />}
					style={iconSx}
				>
					<Box
						component="span"
						sx={{ display: { xs: "none", md: "inline" } }}
					>
						Filters
					</Box>
				</FilterPanelTrigger>
				<ColumnsPanelTrigger
					size="small"
					startIcon={<ViewColumnIcon />}
					style={iconSx}
				>
					<Box
						component="span"
						sx={{ display: { xs: "none", md: "inline" } }}
					>
						Columns
					</Box>
				</ColumnsPanelTrigger>
			</Box>
		</Box>
	);
};

// ── Component ─────────────────────────────────────────────────────────

const Prices: React.FC = () => {
	const [rows, setRows] = useState<SlsPrcWithDet[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(0);
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
	const [rowCount, setRowCount] = useState(0);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInputValue, setSearchInputValue] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const searchTimeoutRef = useRef<number>(0);

	// Price Class filter state
	const [priceClassID, setPriceClassID] = useState<string | null>(null);
	const [priceClassOptions, setPriceClassOptions] = useState<string[]>([]);
	const priceClassIDRef = useRef<string | null>(priceClassID);
	useEffect(() => { priceClassIDRef.current = priceClassID; }, [priceClassID]);

	// Commit search on Enter key or button click, reset to page 0
	const handleSearch = useCallback(() => {
		const value = searchInputValue.trim();
		if (isSearching) return;
		setIsSearching(true);
		setSearchQuery(value);
		setPage(0);
	}, [isSearching, searchInputValue]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				handleSearch();
			}
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

	// Fetch whenever page, pageSize or searchQuery changes
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
				if (searchQuery) {
					params.set("search", searchQuery);
				}
				const pcID = priceClassIDRef.current;
				if (pcID) params.set("priceClassID", pcID);
				const res = await apiRequest<PaginatedResponse<SlsPrcWithDet>>(
					`/price?${params}`,
				);
				if (!cancelled) {
					const withId = res.data.map((row, index) => ({
						...row,
						_id: `${row.SlsPrcID}__${index}`,
					}));
					setRows(withId);
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
	}, [page, pageSize, searchQuery, priceClassID]);

	// Fetch price class options for the filter
	useEffect(() => {
		let cancelled = false;

		const fetchOptions = async () => {
			try {
				const res = await apiRequest<string[]>("/price/class");
				if (!cancelled) {
					setPriceClassOptions(res);
				}
			} catch {
				// non-critical; filter just won't have suggestions
			}
		};

		fetchOptions();
		return () => { cancelled = true; };
	}, []);

	const handlePaginationModelChange = (newModel: GridPaginationModel) => {
		setPage(newModel.page);
		setPageSize(newModel.pageSize);
	};

	const columns: GridColDef[] = [
		{
			field: "SlsPrcID",
			headerName: "Price ID",
			width: 150,
		},
		{
			field: "InvtID",
			headerName: "Inventory ID",
			width: 150,
		},
		{
			field: "Descr",
			headerName: "Description",
			minWidth: 250,
			flex: 1,
		},
		{
			field: "CatalogNbr",
			headerName: "Price Class",
			width: 150,
		},
		{
			field: "DiscPrice",
			headerName: "Discount Price",
			width: 150,
			type: "number",
			valueFormatter: (value: number | null) => {
				if (value === null || value === undefined) return "";
				return value.toLocaleString(undefined, {
					minimumFractionDigits: 2,
					maximumFractionDigits: 4,
				});
			},
		},
		{
			field: "SlsUnit",
			headerName: "Sales Unit",
			width: 150,
		},
	];

	return (
		<Paper sx={{ width: "100%", mb: 2, height: "100%" }}>
			{error ? (
				<Alert severity="error" sx={{ m: 2 }}>
					{error}
				</Alert>
			) : (
				<DataGrid
					rows={rows}
					columns={columns}
					getRowId={(row) => row._id}
					paginationModel={{ page, pageSize }}
					onPaginationModelChange={handlePaginationModelChange}
					paginationMode="server"
					rowCount={rowCount}
					loading={loading}
					pageSizeOptions={[25, 50, 100]}
					disableColumnSorting
					slots={{ toolbar: PricesToolbar }}
					showToolbar
					initialState={{
						columns: { columnVisibilityModel: { SlsPrcID: false } },
					}}
					slotProps={{
						toolbar: {
							searchInputValue,
							onSearchInputChange: setSearchInputValue,
							handleSearch,
							handleKeyDown,
							clearSearch,
							isSearching,
							priceClassID,
							priceClassOptions,
							onPriceClassIDChange: setPriceClassID,
						},
						loadingOverlay: {
							variant: "skeleton",
						},
					}}
					sx={{
						height: 600,
						"& .MuiDataGrid-cell:focus": {
							outline: "none",
						},
					}}
				/>
			)}
		</Paper>
	);
};

export default Prices;
