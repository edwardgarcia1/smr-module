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

// ── Types matching item.schema.ts ──────────────────────────────────────

/** Raw row from GET /item — Inventory + Component + ItemSite joined */
interface JoinedInventoryRow {
	InvtID: string;
	ClassID: string | null;
	ProdMgrID: string | null;
	Descr: string | null;
	KitID: string | null;
	CmpnentID: string | null;
	CmpnentQty: number | null;
	SiteID: string | null;
	QtyAlloc: number | null;
	QtyOnPO: number | null;
	QtyOnHand: number | null;
	QtyAvail: number | null;
	TotCost: number | null;
	LUpd_DateTime: string | null;
}

/** Aggregated row displayed in the grid — one per (InvtID, SiteID) */
interface InventoryRow {
	InvtID: string;
	ClassID: string | null;
	ProdMgrID: string | null;
	Descr: string | null;
	isPromo: number; // 1 = has Components, 0 = no Components
	SiteID: string | null;
	QtyAlloc: number;
	QtyOnPO: number;
	QtyOnHand: number;
	QtyAvail: number;
	LUpd_DateTime: string | null;
}

/** Group joined rows by (InvtID, SiteID) — one row per site */
function aggregateJoinedRows(rows: JoinedInventoryRow[]): InventoryRow[] {
	const map = new Map<string, InventoryRow>();

	for (const row of rows) {
		const key = `${row.InvtID}|${row.SiteID ?? ""}`;
		let agg = map.get(key);
		if (!agg) {
			agg = {
				InvtID: row.InvtID,
				ClassID: row.ClassID,
				ProdMgrID: row.ProdMgrID,
				Descr: row.Descr,
				isPromo: 0,
				SiteID: row.SiteID,
				QtyAlloc: row.QtyAlloc ?? 0,
				QtyOnPO: row.QtyOnPO ?? 0,
				QtyOnHand: row.QtyOnHand ?? 0,
				QtyAvail: row.QtyAvail ?? 0,
				LUpd_DateTime: row.LUpd_DateTime ?? null,
			};
			map.set(key, agg);
		} else if (row.LUpd_DateTime && !agg.LUpd_DateTime) {
			// Prefer first non-null LUpd_DateTime across joined rows
			agg.LUpd_DateTime = row.LUpd_DateTime;
		}

		// Promo = has at least one Component row for this InvtID
		if (row.KitID !== null) {
			agg.isPromo = 1;
		}
	}

	return Array.from(map.values());
}

// ── Constants ─────────────────────────────────────────────────────────
// Community edition limited to 100 rows per page
const DEFAULT_PAGE_SIZE = 100;

type PromoFilter = "all" | "promos" | "non_promos";

// ── Component ─────────────────────────────────────────────────────────

const InventoryItems: React.FC = () => {
	const [rows, setRows] = useState<InventoryRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(0);
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
	const [searchQuery, setSearchQuery] = useState("");
	const [promoFilter, setPromoFilter] = useState<PromoFilter>("all");
	const searchInputRef = useRef<HTMLInputElement>(null);
	const [isSearching, setIsSearching] = useState(false);
	const searchTimeoutRef = useRef<number>(0);

	// Commit search on Enter key or button click, reset to page 0
	const handleSearch = useCallback(() => {
		const value = searchInputRef.current?.value ?? "";
		if (isSearching) return;
		setIsSearching(true);
		setSearchQuery(value);
		setPage(0);
	}, [isSearching]);

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
		setPage(0);
		if (searchInputRef.current) {
			searchInputRef.current.value = "";
		}
	}, []);

	// Fetch joined Inventory + Component + ItemSite data, then aggregate
	useEffect(() => {
		let cancelled = false;

		const fetchData = async () => {
			setLoading(true);
			setError(null);
			try {
				const data = await apiRequest<JoinedInventoryRow[]>("/item");
				if (!cancelled) {
					const aggregated = aggregateJoinedRows(data);

					// Apply promo filter on client side
					const filtered =
						promoFilter === "all"
							? aggregated
							: aggregated.filter((r) =>
									promoFilter === "promos" ? r.isPromo === 1 : r.isPromo === 0,
								);

					setRows(filtered);
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

	// Client-side search filter (async via setTimeout so spinner can paint)
	const [filteredRows, setFilteredRows] = useState<InventoryRow[]>([]);

	useEffect(() => {
		window.clearTimeout(searchTimeoutRef.current);

		if (!searchQuery.trim()) {
			setFilteredRows(rows);
			setIsSearching(false);
			return;
		}

		searchTimeoutRef.current = window.setTimeout(() => {
			const q = searchQuery.toLowerCase().trim();
			const result = rows.filter((item) => {
				return (
					item.InvtID.toLowerCase().includes(q) ||
					(item.SiteID ?? "").toLowerCase().includes(q) ||
					(item.Descr ?? "").toLowerCase().includes(q) ||
					(item.ProdMgrID ?? "").toLowerCase().includes(q) ||
					(item.ClassID ?? "").toLowerCase().includes(q) ||
					(item.LUpd_DateTime ?? "").toLowerCase().includes(q) ||
					(item.LUpd_DateTime
						? new Date(item.LUpd_DateTime)
								.toLocaleDateString(undefined, {
									year: "numeric",
									month: "2-digit",
									day: "2-digit",
									hour: "2-digit",
									minute: "2-digit",
									second: "2-digit",
								})
								.toLowerCase()
								.includes(q)
						: false)
				);
			});
			setFilteredRows(result);
			setIsSearching(false);
		}, 0);
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
			field: "ClassID",
			headerName: "Class ID",
			width: 120,
			valueFormatter: (value: string | null) => value ?? "-",
		},
		{
			field: "SiteID",
			headerName: "Site",
			width: 100,
			valueFormatter: (value: string | null) => value ?? "-",
		},
		{
			field: "Descr",
			headerName: "Description",
			minWidth: 250,
			flex: 1,
			valueFormatter: (value: string | null) => value ?? "-",
		},
		{
			field: "QtyAlloc",
			headerName: "Unreleased",
			width: 120,
			type: "number",
			valueFormatter: (value: number) =>
				value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
		},
		{
			field: "QtyOnPO",
			headerName: "Incoming",
			width: 120,
			type: "number",
			valueFormatter: (value: number) =>
				value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
		},
		{
			field: "QtyOnHand",
			headerName: "On Hand",
			width: 120,
			type: "number",
			valueFormatter: (value: number) =>
				value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
		},
		{
			field: "QtyAvail",
			headerName: "Available",
			width: 120,
			type: "number",
			valueFormatter: (value: number) =>
				value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
		},
		{
			field: "LUpd_DateTime",
			headerName: "Last Update",
			width: 190,
			type: "dateTime",
			valueGetter: (value: string | null) =>
				value ? new Date(value) : null,
			valueFormatter: (value: Date | null) => {
				if (!value) return "-";
				return value.toLocaleDateString(undefined, {
					year: "numeric",
					month: "2-digit",
					day: "2-digit",
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
				});
			},
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
				<Box
					sx={{
						display: "flex",
						flexDirection: { xs: "column", sm: "row" },
						alignItems: { xs: "flex-start", sm: "center" },
						gap: { xs: 0.5, sm: 2 },
					}}
				>
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
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						gap: 1,
						width: { xs: "100%", md: "auto" },
					}}
				>
					<TextField
						inputRef={searchInputRef}
						size="small"
						placeholder="Search inventory... (Enter to search)"
						defaultValue=""
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
	}, [handleSearch, handleKeyDown, clearSearch, promoFilter, loading, isSearching]);

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
					getRowId={(row) => `${row.InvtID}|${row.SiteID ?? ""}`}
					paginationModel={{ page, pageSize }}
					onPaginationModelChange={handlePaginationModelChange}
					paginationMode="client"
					rowCount={filteredRows.length}
					loading={loading || isSearching}
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
