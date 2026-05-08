import React, { useState, useEffect, useCallback, useRef } from "react";
import {
	Box,
	Paper,
	Alert,
	TextField,
	InputAdornment,
	IconButton,
	Typography,
	Radio,
	RadioGroup,
	FormControlLabel,
	FormControl,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
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

// ── Types matching item.schema.ts ──────────────────────────────────────

interface Inventory {
	InvtID: string;
	ClassID: string | null;
	ProdMgrID: string | null;
	Descr: string | null;
	isPromo: number; // 1 = promo (has Components), 0 = regular; used internally
}

// ── Constants ─────────────────────────────────────────────────────────
// Community edition limited to 100 rows per page
const DEFAULT_PAGE_SIZE = 100;

type PromoFilter = "all" | "promos" | "non_promos";

// ── Component ─────────────────────────────────────────────────────────

const InventoryItems: React.FC = () => {
	const [rows, setRows] = useState<Inventory[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(0);
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
	const [searchQuery, setSearchQuery] = useState("");
	const [promoFilter, setPromoFilter] = useState<PromoFilter>("all");
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Commit search on Enter key or button click, reset to page 0
	const handleSearch = useCallback(() => {
		const value = searchInputRef.current?.value ?? "";
		setSearchQuery(value);
		setPage(0);
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				handleSearch();
			}
		},
		[handleSearch],
	);

	// Fetch inventory items, toggling promoFilter via query param
	useEffect(() => {
		let cancelled = false;

		const fetchData = async () => {
			setLoading(true);
			setError(null);
			try {
				const params = new URLSearchParams();
				if (promoFilter !== "all") {
					params.set("promoFilter", promoFilter);
				}
				const data = await apiRequest<Inventory[]>(
					`/item/inventory${params.toString() ? `?${params}` : ""}`,
				);
				if (!cancelled) {
					setRows(data);
				}
			} catch (err: unknown) {
				if (!cancelled) {
					setError(
						err instanceof Error ? err.message : "Failed to fetch inventory items",
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		};

		fetchData();
		return () => {
			cancelled = true;
		};
	}, [promoFilter]);

	// Client-side search filter
	const filteredRows = React.useMemo(() => {
		if (!searchQuery.trim()) return rows;

		const q = searchQuery.toLowerCase().trim();
		return rows.filter((item) => {
			return (
				item.InvtID.toLowerCase().includes(q) ||
				(item.Descr ?? "").toLowerCase().includes(q) ||
				(item.ProdMgrID ?? "").toLowerCase().includes(q) ||
				(item.ClassID ?? "").toLowerCase().includes(q)
			);
		});
	}, [rows, searchQuery]);

	const handlePaginationModelChange = (newModel: GridPaginationModel) => {
		setPage(newModel.page);
		setPageSize(newModel.pageSize);
	};

	const columns: GridColDef[] = [
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
			valueFormatter: (value: string | null) => value ?? "-",
		},
		{
			field: "ProdMgrID",
			headerName: "Product Manager",
			width: 150,
			valueFormatter: (value: string | null) => value ?? "-",
		},
		{
			field: "ClassID",
			headerName: "Price Class",
			width: 150,
			valueFormatter: (value: string | null) => value ?? "-",
		},
	];

	// ─── Custom Toolbar ────────────────────────────────────────────────

	const CustomToolbar = useCallback(() => {
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
					justifyContent: "space-between",
					alignItems: "center",
					px: 2,
					py: 1,
					borderBottom: "1px solid",
					borderColor: "divider",
				}}
			>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
					<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
						Inventory Items
					</Typography>
					<FormControl component="fieldset" variant="standard">
						<RadioGroup
							row
							value={promoFilter}
							onChange={(_, value) => {
								setPromoFilter(value as PromoFilter);
								setPage(0);
								setSearchQuery("");
								if (searchInputRef.current) {
									searchInputRef.current.value = "";
								}
							}}
						>
							<FormControlLabel
								value="all"
								control={<Radio size="small" />}
								label="All"
								disabled={loading}
								sx={{
									"& .MuiFormControlLabel-label": {
										fontSize: "0.8125rem",
										fontWeight: 500,
									},
								}}
							/>
							<FormControlLabel
								value="promos"
								control={<Radio size="small" />}
								label="Promos"
								disabled={loading}
								sx={{
									"& .MuiFormControlLabel-label": {
										fontSize: "0.8125rem",
										fontWeight: 500,
									},
								}}
							/>
							<FormControlLabel
								value="non_promos"
								control={<Radio size="small" />}
								label="Non-Promos"
								disabled={loading}
								sx={{
									"& .MuiFormControlLabel-label": {
										fontSize: "0.8125rem",
										fontWeight: 500,
									},
								}}
							/>
						</RadioGroup>
					</FormControl>
				</Box>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					<TextField
						inputRef={searchInputRef}
						size="small"
						placeholder="Search inventory... (Enter to search)"
						defaultValue=""
						onKeyDown={handleKeyDown}
						slotProps={{
							input: {
								endAdornment: (
									<InputAdornment position="end">
										<IconButton
											size="small"
											onClick={handleSearch}
											aria-label="search"
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
							minWidth: 240,
						}}
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
	}, [handleSearch, handleKeyDown, promoFilter, loading]);

	return (
		<Paper sx={{ width: "100%", mb: 2, height: "100%" }}>
			{error ? (
				<Alert severity="error" sx={{ m: 2 }}>
					{error}
				</Alert>
			) : (
				<DataGrid
					rows={filteredRows}
					columns={columns}
					getRowId={(row) => row.InvtID}
					paginationModel={{ page, pageSize }}
					onPaginationModelChange={handlePaginationModelChange}
					paginationMode="client"
					rowCount={filteredRows.length}
					loading={loading}
					pageSizeOptions={[25, 50, 100]}
					disableColumnSorting
					slots={{ toolbar: CustomToolbar }}
					showToolbar
					slotProps={{
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

export default InventoryItems;
