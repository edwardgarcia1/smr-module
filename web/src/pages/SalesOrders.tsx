import React, { useState, useEffect, useCallback, useRef } from "react";
import {
	Box,
	Paper,
	Alert,
	TextField,
	Typography,
	IconButton,
	Button,
	Autocomplete,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogContentText,
	DialogActions,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import FilterListIcon from "@mui/icons-material/FilterList";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {
	DataGrid,
	ColumnsPanelTrigger,
	FilterPanelTrigger,
	type GridColDef,
	type GridPaginationModel,
} from "@mui/x-data-grid";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import type { Dayjs } from "dayjs";
import apiRequest from "../services/api";

// ── Types ─────────────────────────────────────────────────────────────

interface SalesRecord {
	shipperID: string;
	ordDate: string;
	deliveryDate: string;
	invcNbr: string;
	prodMgrID: string;
	classID: string;
	classDescr: string;
	custID: string;
	shiptoID: string;
	billName: string;
	shipName: string;
	poNumber: string;
	invtID: string;
	descr: string;
	qtyOrd: number;
	qtyShip: number;
	slsPrice: number;
	chainDisc: string;
	discPct: number;
	discAmt: number;
	gross: number;
	totInvc: number;
	cnvFact: number;
	unitDesc: string;
	docDate: string;
	soTypeID: string;
	siteID: string;
	company: string;
	custClassID: string;
	slsShipToID: string;
	kob: string;
	priceClassID: string;
	slsperID: string;
	totCost: number;
	cost: number;
	unservedQty: number;
	unservedAmt: number;
	sprNo: string;
	otd: number;
	soDate: string;
}

interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

interface SiteOption {
	SiteId: string;
	Name: string;
}

// ── Constants ─────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 100;

// ── Component ─────────────────────────────────────────────────────────

const SalesOrders: React.FC = () => {
	const [rows, setRows] = useState<SalesRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(0);
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
	const [rowCount, setRowCount] = useState(0);

	// Filter state
	const [siteID, setSiteID] = useState<string | null>(null);
	const [siteOptions, setSiteOptions] = useState<SiteOption[]>([]);
	const [priceClassID, setPriceClassID] = useState("");
	const [classID, setClassID] = useState<string | null>(null);
	const [classIDOptions, setClassIDOptions] = useState<{ ClassID: string; Descr: string }[]>([]);
	const [dateRanges, setDateRanges] = useState<
		{ from: Dayjs | null; to: Dayjs | null }[]
	>([{ from: null, to: null }]);
	const [searchTrigger, setSearchTrigger] = useState(0);

	// Refs to read latest filter values inside fetchData without triggering re-creation
	const siteIDRef = useRef(siteID);
	const priceClassIDRef = useRef(priceClassID);
	const classIDRef = useRef(classID);
	const dateRangesRef = useRef(dateRanges);
	useEffect(() => { siteIDRef.current = siteID; }, [siteID]);
	useEffect(() => { priceClassIDRef.current = priceClassID; }, [priceClassID]);
	useEffect(() => { classIDRef.current = classID; }, [classID]);
	useEffect(() => { dateRangesRef.current = dateRanges; }, [dateRanges]);

	// ─── Fetch ─────────────────────────────────────────────────────────

	const fetchData = useCallback(async (currentPage: number) => {
		setLoading(true);
		setError(null);
		try {
			const sID = siteIDRef.current;
			const pcID = priceClassIDRef.current;
			const cID = classIDRef.current;
			const dRanges = dateRangesRef.current;

			const params = new URLSearchParams({
				page: String(currentPage + 1),
				limit: String(pageSize),
			});

			for (const dr of dRanges) {
				if (dr.from && dr.to) {
					params.append("dateRange", `${dr.from.format("YYYY-MM-DD")},${dr.to.format("YYYY-MM-DD")}`);
				}
			}

			if (sID) params.set("siteID", sID);
			if (pcID.trim()) params.set("priceClassID", pcID.trim());
			if (cID) params.set("classID", cID);

			const res = await apiRequest<PaginatedResponse<SalesRecord>>(`/sales?${params}`);
			setRows(res.data);
			setRowCount(res.total);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to fetch sales orders");
		} finally {
			setLoading(false);
		}
	}, [pageSize]);

	// Load on mount, page change, or apply trigger
	useEffect(() => {
		fetchData(page);
	}, [fetchData, page, searchTrigger]);

	const handlePaginationModelChange = (newModel: GridPaginationModel) => {
		setPage(newModel.page);
		setPageSize(newModel.pageSize);
	};

	// ─── Apply / Clear ─────────────────────────────────────────────────

	const [clearDialogOpen, setClearDialogOpen] = useState(false);

	const handleApply = useCallback(() => {
		setPage(0);
		setSearchTrigger((t) => t + 1);
	}, []);

	const handleClearAll = useCallback(() => {
		setSiteID(null);
		setPriceClassID("");
		setClassID(null);
		setDateRanges([{ from: null, to: null }]);
		setPage(0);
		setSearchTrigger((t) => t + 1);
		setClearDialogOpen(false);
	}, []);

	// ─── Fetch options for Autocompletes ─────────────────────────────

	useEffect(() => {
		let cancelled = false;

		const fetchOptions = async () => {
			try {
				const [sites, classes] = await Promise.all([
					apiRequest<SiteOption[]>("/inventory"),
					apiRequest<{ ClassID: string; Descr: string }[]>("/principal/ids"),
				]);
				if (!cancelled) {
					setSiteOptions(sites);
					setClassIDOptions(classes);
				}
			} catch {
				// non-critical; filters just won't have suggestions
			}
		};

		fetchOptions();
		return () => { cancelled = true; };
	}, []);

	// ─── Date range handlers ────────────────────────────────────────────

	const handleAddDateRange = useCallback(() => {
		setDateRanges((prev) => [...prev, { from: null, to: null }]);
	}, []);

	const handleRemoveDateRange = useCallback((index: number) => {
		setDateRanges((prev) => prev.filter((_, i) => i !== index));
	}, []);

	const handleUpdateDateRange = useCallback(
		(index: number, field: "from" | "to", value: Dayjs | null) => {
			setDateRanges((prev) =>
				prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
			);
		},
		[],
	);

	const handleClearDateRanges = useCallback(() => {
		setDateRanges([{ from: null, to: null }]);
	}, []);

	// ─── Columns ────────────────────────────────────────────────────────

	const columns: GridColDef[] = [
		{ field: "shipperID", headerName: "Shipper ID", width: 120 },
		{ field: "ordDate", headerName: "Order Date", width: 110 },
		{ field: "deliveryDate", headerName: "Delivery Date", width: 110 },
		{ field: "invcNbr", headerName: "Invoice #", width: 110 },
		{ field: "prodMgrID", headerName: "Prod Mgr ID", width: 110 },
		{ field: "classID", headerName: "Class ID", width: 100 },
		{ field: "classDescr", headerName: "Class Description", width: 160 },
		{ field: "custID", headerName: "Customer ID", width: 110 },
		{ field: "shiptoID", headerName: "Ship To ID", width: 110 },
		{ field: "billName", headerName: "Bill Name", width: 180 },
		{ field: "shipName", headerName: "Ship Name", width: 180 },
		{ field: "poNumber", headerName: "PO Number", width: 130 },
		{ field: "invtID", headerName: "Inventory ID", width: 120 },
		{ field: "descr", headerName: "Description", minWidth: 220, flex: 1 },
		{
			field: "qtyOrd",
			headerName: "Qty Ordered",
			width: 110,
			type: "number",
			valueFormatter: (v?: number) => (v != null ? v.toLocaleString() : ""),
		},
		{
			field: "qtyShip",
			headerName: "Qty Shipped",
			width: 110,
			type: "number",
			valueFormatter: (v?: number) => (v != null ? v.toLocaleString() : ""),
		},
		{
			field: "slsPrice",
			headerName: "Sales Price",
			width: 110,
			type: "number",
			valueFormatter: (v?: number) =>
				v != null ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "",
		},
		{ field: "chainDisc", headerName: "Chain Disc", width: 100 },
		{
			field: "discPct",
			headerName: "Disc %",
			width: 90,
			type: "number",
			valueFormatter: (v?: number) => (v != null ? `${v.toFixed(2)}%` : ""),
		},
		{
			field: "discAmt",
			headerName: "Disc Amount",
			width: 110,
			type: "number",
			valueFormatter: (v?: number) =>
				v != null ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
		},
		{
			field: "gross",
			headerName: "Gross",
			width: 110,
			type: "number",
			valueFormatter: (v?: number) =>
				v != null ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
		},
		{
			field: "totInvc",
			headerName: "Total Invoice",
			width: 120,
			type: "number",
			valueFormatter: (v?: number) =>
				v != null ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
		},
		{
			field: "cnvFact",
			headerName: "Conv Factor",
			width: 100,
			type: "number",
			valueFormatter: (v?: number) =>
				v != null ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "",
		},
		{ field: "unitDesc", headerName: "Unit", width: 90 },
		{ field: "docDate", headerName: "Doc Date", width: 110 },
		{ field: "soTypeID", headerName: "SO Type", width: 90 },
		{ field: "siteID", headerName: "Site ID", width: 90 },
		{ field: "company", headerName: "Company", width: 110 },
		{ field: "custClassID", headerName: "Cust Class ID", width: 120 },
		{ field: "slsShipToID", headerName: "SLS Ship To ID", width: 130 },
		{ field: "kob", headerName: "KOB", width: 80 },
		{ field: "priceClassID", headerName: "Price Class", width: 110 },
		{ field: "slsperID", headerName: "Salesperson ID", width: 120 },
		{
			field: "totCost",
			headerName: "Total Cost",
			width: 110,
			type: "number",
			valueFormatter: (v?: number) =>
				v != null ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
		},
		{
			field: "cost",
			headerName: "Cost",
			width: 100,
			type: "number",
			valueFormatter: (v?: number) =>
				v != null ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
		},
		{
			field: "unservedQty",
			headerName: "Unserved Qty",
			width: 110,
			type: "number",
			valueFormatter: (v?: number) => (v != null ? v.toLocaleString() : ""),
		},
		{
			field: "unservedAmt",
			headerName: "Unserved Amount",
			width: 130,
			type: "number",
			valueFormatter: (v?: number) =>
				v != null ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
		},
		{ field: "sprNo", headerName: "SPR No", width: 100 },
		{ field: "otd", headerName: "OTD (Days)", width: 105, type: "number" },
		{ field: "soDate", headerName: "SO Date", width: 110 },
	];

	// ─── Custom Toolbar ────────────────────────────────────────────────

	const CustomToolbar = useCallback(() => {
		const inputSx = {
			"& .MuiOutlinedInput-root": { borderRadius: 2, height: 32 },
			"& .MuiInputBase-input": { paddingY: 0, fontSize: "0.8rem" },
		};
		const labelSx = { display: { xs: "none", md: "inline" } };

		return (
			<Box
				sx={{
					px: 2,
					py: 1,
					borderBottom: "1px solid",
					borderColor: "divider",
				}}
			>
				{/* Row 1: Title + action buttons */}
				<Box
					sx={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						mb: 1,
					}}
				>
					<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
						Sales Orders
					</Typography>
					<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
						<FilterPanelTrigger
							size="small"
							startIcon={<FilterListIcon />}
							style={{ minWidth: "auto", textTransform: "none", fontSize: "0.8125rem", fontWeight: 500, paddingLeft: 0.75, paddingRight: 0.75 }}
						>
							<Box component="span" sx={labelSx}>Filters</Box>
						</FilterPanelTrigger>
						<ColumnsPanelTrigger
							size="small"
							startIcon={<ViewColumnIcon />}
							style={{ minWidth: "auto", textTransform: "none", fontSize: "0.8125rem", fontWeight: 500, paddingLeft: 0.75, paddingRight: 0.75 }}
						>
							<Box component="span" sx={labelSx}>Columns</Box>
						</ColumnsPanelTrigger>
					</Box>
				</Box>

				{/* Row 2: Filter fields */}
				<Box
					sx={{
						display: "flex",
						flexWrap: "wrap",
						alignItems: "center",
						gap: 1,
					}}
				>
					<Autocomplete
						size="small"
						options={siteOptions}
						value={siteOptions.find((o) => o.SiteId === siteID) ?? null}
						onChange={(_, newVal) =>
							setSiteID(newVal?.SiteId ?? null)
						}
						getOptionLabel={(option) => `${option.SiteId} — ${option.Name}`}
						isOptionEqualToValue={(option, val) => option.SiteId === val.SiteId}
						renderInput={(params) => (
							<TextField
								{...params}
								placeholder="Filter by Site"
								sx={{ minWidth: 200, maxWidth: 280 }}
							/>
						)}
					/>
					<TextField
						size="small"
						placeholder="Price Class"
						value={priceClassID}
						onChange={(e) => setPriceClassID(e.target.value)}
						sx={{ minWidth: 110, maxWidth: 140, ...inputSx }}
					/>
					<Autocomplete
						size="small"
						options={classIDOptions}
						value={classIDOptions.find((o) => o.ClassID === classID) ?? null}
						onChange={(_, newVal) =>
							setClassID(newVal?.ClassID ?? null)
						}
						getOptionLabel={(option) => `${option.ClassID} — ${option.Descr}`}
						isOptionEqualToValue={(option, val) => option.ClassID === val.ClassID}
						renderInput={(params) => (
							<TextField
								{...params}
								placeholder="Class ID"
								sx={{ minWidth: 200, maxWidth: 280 }}
							/>
						)}
					/>
				</Box>

				{/* Row 3: Date range filters */}
				<Box
					sx={{
						display: "flex",
						flexWrap: "wrap",
						alignItems: "center",
						gap: 1,
						mt: 0.5,
					}}
				>
					<Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", mr: 0.5, whiteSpace: "nowrap" }}>
						Invoice Date:
					</Typography>
					<LocalizationProvider dateAdapter={AdapterDayjs}>
						{dateRanges.map((dr, index) => (
							<Box key={index} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
								<DatePicker
									label={`From${dateRanges.length > 1 ? index + 1 : ""}`}
									value={dr.from}
									onChange={(v) => handleUpdateDateRange(index, "from", v)}
									slotProps={{
										textField: {
											size: "small",
											sx: {
												width: 130,
												...inputSx,
												"& .MuiInputLabel-root": { fontSize: "0.75rem", top: -4 },
											},
										},
									}}
								/>
								<DatePicker
									label={`To${dateRanges.length > 1 ? index + 1 : ""}`}
									value={dr.to}
									onChange={(v) => handleUpdateDateRange(index, "to", v)}
									slotProps={{
										textField: {
											size: "small",
											sx: {
												width: 130,
												...inputSx,
												"& .MuiInputLabel-root": { fontSize: "0.75rem", top: -4 },
											},
										},
									}}
								/>
								{dateRanges.length > 1 && (
									<IconButton
										size="small"
										onClick={() => handleRemoveDateRange(index)}
										color="error"
										sx={{ p: 0.5 }}
									>
										<DeleteIcon fontSize="small" />
									</IconButton>
								)}
							</Box>
						))}
					</LocalizationProvider>

					<Button
						size="small"
						variant="outlined"
						startIcon={<AddIcon />}
						onClick={handleAddDateRange}
						sx={{ borderRadius: 2, textTransform: "none", height: 32, fontSize: "0.8rem", whiteSpace: "nowrap" }}
					>
						Add Date
					</Button>
					<Button
						size="small"
						variant="outlined"
						color="error"
						startIcon={<DeleteIcon />}
						onClick={handleClearDateRanges}
						sx={{ borderRadius: 2, textTransform: "none", height: 32, fontSize: "0.8rem" }}
					>
						Clear Dates
					</Button>
				</Box>

				{/* Row 4: Action buttons */}
				<Box
					sx={{
						display: "flex",
						justifyContent: "flex-end",
						gap: 1,
						mt: 1,
						pt: 1,
						borderTop: "1px solid",
						borderColor: "divider",
					}}
				>
					<Button
						variant="outlined"
						color="error"
						startIcon={<ClearAllIcon />}
						onClick={() => setClearDialogOpen(true)}
						sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.8125rem" }}
					>
						Clear Filters
					</Button>
					<Button
						variant="contained"
						startIcon={<PlayArrowIcon />}
						onClick={handleApply}
						sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.8125rem" }}
					>
						Apply Filter
					</Button>
				</Box>
			</Box>
		);
	}, [siteID, siteOptions, priceClassID, classID, classIDOptions, dateRanges, handleUpdateDateRange, handleRemoveDateRange, handleAddDateRange, handleClearDateRanges, handleApply]);

	// ─── Render ─────────────────────────────────────────────────────────

	return (
		<>
			<Dialog
				open={clearDialogOpen}
				onClose={() => setClearDialogOpen(false)}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle>Clear All Filters?</DialogTitle>
				<DialogContent>
					<DialogContentText>
						This will reset all filter fields, date ranges, and the results grid. This action cannot be undone.
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setClearDialogOpen(false)}>Cancel</Button>
					<Button onClick={handleClearAll} variant="contained" color="error">
						Clear All
					</Button>
				</DialogActions>
			</Dialog>
			<Paper sx={{ width: "100%", mb: 2, height: "100%" }}>
			{error ? (
				<Alert severity="error" sx={{ m: 2 }}>
					{error}
				</Alert>
			) : (
				<DataGrid
					rows={rows}
					columns={columns}
					getRowId={(row) => `${row.shipperID}|${row.invtID}|${row.invcNbr}`}
					paginationModel={{ page, pageSize }}
					onPaginationModelChange={handlePaginationModelChange}
					paginationMode="server"
					rowCount={rowCount}
					loading={loading}
					pageSizeOptions={[25, 50, 100, 200, 500]}
					disableColumnSorting
					slots={{ toolbar: CustomToolbar }}
					showToolbar
					initialState={{
						columns: {
							columnVisibilityModel: {
								chainDisc: false,
								cnvFact: false,
								unitDesc: false,
								docDate: false,
								soTypeID: false,
								kob: false,
								slsperID: false,
								sprNo: false,
								soDate: false,
								custClassID: false,
								slsShipToID: false,
							},
						},
					}}
					slotProps={{
						loadingOverlay: { variant: "skeleton" },
					}}
					sx={{
						height: 700,
						"& .MuiDataGrid-cell:focus": { outline: "none" },
					}}
				/>
			)}
		</Paper>
		</>
	);
};

export default SalesOrders;
