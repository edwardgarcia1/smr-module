import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
	Box,
	Paper,
	Typography,
	TextField,
	Button,
	Grid,
	FormControl,
	Radio,
	RadioGroup,
	FormControlLabel,
	FormLabel,
	Autocomplete,
	IconButton,
	Alert,
	Tooltip,
	Checkbox,
	CircularProgress,
	Divider,
	useTheme,
} from "@mui/material";
import { useThemeMode } from "../providers/AppProvider";
import {
	DataGrid,
	ColumnsPanelTrigger,
	FilterPanelTrigger,
	ExportCsv,
	ExportPrint,
} from "@mui/x-data-grid";
import type { GridColDef, GridRowModel, GridRowsProp } from "@mui/x-data-grid";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { type Dayjs } from "dayjs";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AddIcon from "@mui/icons-material/Add";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import FilterListIcon from "@mui/icons-material/FilterList";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import PrintIcon from "@mui/icons-material/Print";
import TableChartIcon from "@mui/icons-material/TableChart";
import { exportDataGridToExcel } from "../utils/exportToExcel";
import apiRequest from "../services/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type Frequency = "weekly" | "monthly";

interface Principal {
	ClassID: string;
	Descr: string;
	User5: string;
}

interface StorageLocation {
	id: string;
	name: string;
}

/** Row returned by GET /purchasing/requirements */
interface RequirementRow {
	invtID: string;
	descr: string;
	stkUnit: string;
	classID: string;
	qtyOnHand: number;
	qtyAvail: number;
	qtyOnPO: number;
	qtyAlloc: number;
	periodDemand: Record<string, number>;
	avgDemand: number;
	stockCoverCount: number;
	monthlyFactor: number;
	suggestedOrder: number;
	customOrder: number | null;
}

/**
 * Extended row used by the DataGrid — adds a synthetic `id` and
 * aliased getter fields so each period demand column can be referenced.
 */
interface GridRow extends RequirementRow {
	id: number;
}

		// ─── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_SITE_IDS = new Set(["MAIN", "CAB", "3MPMT", "3MPGT"]);

/** Numeric sort value for period labels — ensures chronological column order */
function periodSortValue(key: string): number {
	const monthIdx: Record<string, number> = {
		Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
		Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
	};
	const wm = key.match(/^W(\d+)\s+(\w+)\s+(\d+)$/);
	if (wm && wm[2] && wm[3]) return Number(wm[3]) * 60 + (monthIdx[wm[2]] ?? 0) * 5 + Number(wm[1]);
	const mm = key.match(/^(\w+)\s+(\d+)$/);
	if (mm && mm[1] && mm[2]) return Number(mm[2]) * 12 + (monthIdx[mm[1]] ?? 0);
	return 0;
}

// ─── Form State Persistence ───────────────────────────────────────────────────

const FORM_STORAGE_KEY = "pr-form-state-v5";

interface PersistedFormState {
	selectedPrincipal: Principal | null;
	selectedStorage: StorageLocation[];
	frequency: Frequency;
	dateRanges: { from: string | null; to: string | null }[];
}

function persistFormState(state: PersistedFormState): void {
	try {
		localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(state));
	} catch {
		/* localStorage full or unavailable */
	}
}

function serializeDateRanges(
	ranges: { from: Dayjs | null; to: Dayjs | null }[],
): { from: string | null; to: string | null }[] {
	return ranges.map((r) => ({
		from: r.from?.toISOString() ?? null,
		to: r.to?.toISOString() ?? null,
	}));
}

function deserializeDateRanges(
	serialized: { from: string | null; to: string | null }[],
): { from: Dayjs | null; to: Dayjs | null }[] {
	if (!serialized || serialized.length === 0) return [{ from: null, to: null }];
	return serialized.map((r) => ({
		from: r.from ? dayjs(r.from) : null,
		to: r.to ? dayjs(r.to) : null,
	}));
}

// ─── Main Component ──────────────────────────────────────────────────────────

const PurchasingRequirements: React.FC = () => {
	const { darkMode } = useThemeMode();
	const theme = useTheme();

	// Load persisted form state from localStorage
	const [persistedForm] = useState(() => {
		try {
			const raw = localStorage.getItem(FORM_STORAGE_KEY);
			return raw ? (JSON.parse(raw) as PersistedFormState) : null;
		} catch {
			return null;
		}
	});

	// Theme-aware group colors for data grid headers
	const groupColors = useMemo(
		() => ({
			static: {
				bg: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
			},
			demand: {
				bg: darkMode ? "rgba(144, 202, 249, 0.10)" : "rgba(33, 150, 243, 0.07)",
				color: darkMode ? "#90caf9" : "#1565c0",
			},
			computation: {
				bg: darkMode ? "rgba(255, 183, 77, 0.10)" : "rgba(255, 152, 0, 0.07)",
				color: darkMode ? "#ffb74d" : "#e65100",
			},
			custom: {
				bg: darkMode ? "rgba(129, 199, 132, 0.10)" : "rgba(76, 175, 80, 0.07)",
				color: darkMode ? "#81c784" : "#2e7d32",
			},
		}),
		[darkMode],
	);

	// ─── Filter state ─────────────────────────────────────────────────
	const [selectedPrincipal, setSelectedPrincipal] = useState<Principal | null>(
		persistedForm?.selectedPrincipal ?? null,
	);
	const [principals, setPrincipals] = useState<Principal[]>([]);

	const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
	const [selectedStorage, setSelectedStorage] = useState<StorageLocation[]>(
		persistedForm?.selectedStorage ?? [],
	);

	interface DateRangeItem {
		from: Dayjs | null;
		to: Dayjs | null;
	}
	const [dateRanges, setDateRanges] = useState<DateRangeItem[]>(() => {
		const saved = persistedForm?.dateRanges;
		if (saved && saved.length > 0) {
			return deserializeDateRanges(saved) as DateRangeItem[];
		}
		return [{ from: null, to: null }];
	});

	const [frequency, setFrequency] = useState<Frequency>(
		persistedForm?.frequency ?? "monthly",
	);

	const handleAddDateRange = useCallback(() => {
		setDateRanges((prev) => [...prev, { from: null, to: null }]);
	}, []);

	const handleRemoveDateRange = useCallback((index: number) => {
		setDateRanges((prev) => prev.filter((_, i) => i !== index));
	}, []);

	const handleUpdateDateRange = useCallback(
		(index: number, field: "from" | "to", value: Dayjs | null) => {
			setDateRanges((prev) =>
				prev.map((item, i) =>
					i === index ? { ...item, [field]: value } : item,
				),
			);
		},
		[],
	);

	// ─── Fetch options (sites, principals, price classes) ────────────
	const [priceClasses, setPriceClasses] = useState<string[]>([]);

	useEffect(() => {
		let cancelled = false;
		const fetchOptions = async () => {
			try {
				const [sites, principalList, pClasses] = await Promise.all([
					apiRequest<{ SiteId: string; Name: string }[]>("/inventory"),
					apiRequest<Principal[]>("/principal/ids"),
					apiRequest<string[]>("/price/class"),
				]);
				if (!cancelled) {
					setStorageLocations(
						sites
							.filter((s) => ALLOWED_SITE_IDS.has(s.SiteId))
							.map((s) => ({ id: s.SiteId, name: s.Name })),
					);
					setPrincipals(principalList);
					setPriceClasses(pClasses ?? []);
				}
			} catch {
				// non-critical
			}
		};
		fetchOptions();
		return () => {
			cancelled = true;
		};
	}, []);

	// ─── Grid state ──────────────────────────────────────────────────
	const [rows, setRows] = useState<GridRowsProp>([]);
	const [columns, setColumns] = useState<GridColDef[]>([]);
	const [gridError, setGridError] = useState<string | null>(null);
	const [applied, setApplied] = useState(false);
	const [isApplying, setIsApplying] = useState(false);

	// Toolbar states
	const [bulkFactor, setBulkFactor] = useState<string>("1.0");
	const [selectedPriceClass, setSelectedPriceClass] = useState<string | null>(null);
	const [poReference, setPoReference] = useState("");

	// Ref to track period keys for column building
	const periodKeysRef = useRef<string[]>([]);

	// ─── Build Columns ────────────────────────────────────────────────
	const buildColumns = useCallback(
		(periodKeys: string[]): GridColDef[] => {
			const cols: GridColDef[] = [];

			// Group 1: Static product info
			const staticHeader = { headerClassName: "group-static" };
			cols.push({
				field: "invtID",
				headerName: "Inventory ID",
				width: 110,
				...staticHeader,
			});
			cols.push({
				field: "descr",
				headerName: "Description",
				width: 260,
				...staticHeader,
			});
			cols.push({
				field: "stkUnit",
				headerName: "Stock Unit",
				width: 90,
				...staticHeader,
			});
			cols.push({
				field: "qtyAlloc",
				headerName: "Unreleased",
				width: 110,
				type: "number",
				...staticHeader,
				valueFormatter: (value?: number) =>
					value != null ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
			});
			cols.push({
				field: "qtyOnPO",
				headerName: "Incoming",
				width: 110,
				type: "number",
				...staticHeader,
				valueFormatter: (value?: number) =>
					value != null ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
			});
			cols.push({
				field: "qtyOnHand",
				headerName: "On Hand",
				width: 110,
				type: "number",
				...staticHeader,
				valueFormatter: (value?: number) =>
					value != null ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
			});
			cols.push({
				field: "qtyAvail",
				headerName: "Available",
				width: 110,
				type: "number",
				...staticHeader,
				valueFormatter: (value?: number) =>
					value != null ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
			});

			// Group 2: Monthly/Weekly Demands (dynamic)
			periodKeys.forEach((key) => {
				const fieldKey = `pd_${key.replace(/[\s]/g, "_")}`;
				cols.push({
					field: fieldKey,
					headerName: key,
					width: 110,
					type: "number",
					headerClassName: "group-demand",
					valueGetter: (_value, row) =>
						(row as unknown as GridRow).periodDemand[key] ?? 0,
					valueFormatter: (value?: number) =>
						value != null ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
				});
			});

			// Group 3: Computation
			cols.push({
				field: "stockCoverCount",
				headerName: `Stock Cover (${frequency === "monthly" ? "Months" : "Weeks"})`,
				width: 130,
				type: "number",
				headerClassName: "group-computation",
				valueFormatter: (value?: number) =>
					value != null ? value.toFixed(2) : "",
			});
			cols.push({
				field: "avgDemand",
				headerName: `Average ${frequency === "monthly" ? "Monthly" : "Weekly"} Demand`,
				width: 150,
				type: "number",
				headerClassName: "group-computation",
				valueFormatter: (value?: number) =>
					value != null ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
			});
			cols.push({
				field: "monthlyFactor",
				headerName: "Factor",
				width: 80,
				type: "number",
				editable: true,
				headerClassName: "group-computation",
				renderEditCell: (params) => (
					<input
						type="number"
						step={0.1}
						value={params.value ?? ""}
						onChange={(e) => {
							params.api.setEditCellValue({
								id: params.id,
								field: params.field,
								value: parseFloat(e.target.value) || 0,
							});
						}}
						style={{
							width: "100%",
							height: "100%",
							border: "none",
							outline: "none",
							textAlign: "center",
							padding: "0 8px",
							fontFamily: "inherit",
							fontSize: "inherit",
							color: "inherit",
							background: "transparent",
						}}
						autoFocus
					/>
				),
				valueFormatter: (value?: number) =>
					value != null ? value.toFixed(2) : "",
			});
			cols.push({
				field: "suggestedOrder",
				headerName: "Suggested Order",
				width: 140,
				type: "number",
				headerClassName: "group-computation",
				valueFormatter: (value?: number) =>
					value != null ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
			});

			// Group 4: Custom Order
			cols.push({
				field: "customOrder",
				headerName: "Custom Order",
				width: 130,
				type: "number",
				editable: true,
				headerClassName: "group-custom",
				valueFormatter: (value?: number) =>
					value != null ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
			});

			return cols;
		},
		[frequency],
	);

	// ─── Apply Handler ────────────────────────────────────────────────
	const handleApply = useCallback(async () => {
		setGridError(null);
		setApplied(false);
		setRows([]);
		setColumns([]);
		setIsApplying(true);

		if (!selectedPrincipal) {
			setGridError("Please select a Principal.");
			setIsApplying(false);
			return;
		}
		if (
			dateRanges.length === 0 ||
			dateRanges.some((dr) => !dr.from || !dr.to)
		) {
			setGridError("Please fill in all date ranges.");
			setIsApplying(false);
			return;
		}
		for (const dr of dateRanges) {
			if (dr.to!.isBefore(dr.from!)) {
				setGridError("End date must be after start date in each date range.");
				setIsApplying(false);
				return;
			}
		}

		try {
			// Build query params
			const params = new URLSearchParams();
			params.set("classID", selectedPrincipal.ClassID);
			params.set("frequency", frequency);

			for (const dr of dateRanges) {
				if (dr.from && dr.to) {
					params.append(
						"dateRange",
						`${dr.from.format("YYYY-MM-DD")},${dr.to.format("YYYY-MM-DD")}`,
					);
				}
			}
			for (const s of selectedStorage) {
				params.append("siteID", s.id);
			}

			const data = await apiRequest<RequirementRow[]>(
				`/purchasing/requirements?${params.toString()}`,
			);

			if (!data || data.length === 0) {
				setGridError(
					"No data matches the selected filters. Try adjusting your criteria.",
				);
				setIsApplying(false);
				return;
			}

			// Collect all period keys from the first row (all rows share same keys)
			const periodKeys = Object.keys(data[0].periodDemand ?? {}).sort(
				(a, b) => periodSortValue(a) - periodSortValue(b),
			);
			periodKeysRef.current = periodKeys;

			// Build grid rows with synthetic id
			const gridRows: GridRow[] = data.map((item, idx) => ({
				...item,
				id: idx + 1,
			}));

			// Build columns
			const dynamicCols = buildColumns(periodKeys);
			setColumns(dynamicCols);
			setRows(gridRows);
			setApplied(true);
		} catch (err: unknown) {
			setGridError(
				err instanceof Error
					? err.message
					: "Failed to fetch requirements data.",
			);
		} finally {
			setIsApplying(false);
		}
	}, [selectedPrincipal, selectedStorage, dateRanges, frequency, buildColumns]);

	// ─── Bulk factor update ──────────────────────────────────────────
	const handleBulkFactorApply = useCallback(() => {
		const factor = parseFloat(bulkFactor);
		if (isNaN(factor) || factor <= 0) return;

		setRows((prev: readonly GridRowModel[]) =>
			prev.map((r: GridRowModel) => {
				const row = r as GridRow;
				return {
					...row,
					monthlyFactor: factor,
					suggestedOrder: Math.round(row.avgDemand * factor * 100) / 100,
				};
			}),
		);
	}, [bulkFactor]);

	// ─── Grid Edit Handler ────────────────────────────────────────────
	const processRowUpdate = useCallback(
		(newRow: GridRowModel, oldRow: GridRowModel) => {
			const updatedRow = { ...newRow } as GridRow;

			if (newRow.monthlyFactor !== oldRow.monthlyFactor) {
				updatedRow.suggestedOrder =
					Math.round(newRow.avgDemand * newRow.monthlyFactor * 100) / 100;
			}

			if (newRow.customOrder === "" || newRow.customOrder === null) {
				updatedRow.customOrder = null;
			}

			setRows((prev: readonly GridRowModel[]) =>
				prev.map((r: GridRowModel) =>
					(r as GridRow).id === newRow.id ? updatedRow : r,
				),
			);

			return updatedRow;
		},
		[],
	);

	// ─── Filter Panel ─────────────────────────────────────────────────
	const filterPanel = (
		<Paper sx={{ width: "100%", mb: 3, p: 3, borderRadius: 2 }}>
			<Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
				Purchase Requirements Filters
			</Typography>

			<Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
				{/* Left column - filters (60%) */}
				<Box sx={{ flex: "3 1 0%", minWidth: 300 }}>
					<Grid container spacing={3}>
						{/* Principal - half width */}
						<Grid size={{ xs: 12, md: 6 }}>
							<FormControl fullWidth>
								<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>
									Select Principal
								</FormLabel>
								<Autocomplete
									size="small"
									options={principals}
									value={selectedPrincipal}
									onChange={(_, newVal) => setSelectedPrincipal(newVal)}
									getOptionLabel={(option) => option.Descr}
									isOptionEqualToValue={(option, val) =>
										option.ClassID === val.ClassID
									}
									renderInput={(params) => (
										<TextField
											{...params}
											placeholder="Search or select principal"
											sx={{
												"& .MuiOutlinedInput-root": { borderRadius: 2 },
											}}
										/>
									)}
								/>
							</FormControl>
						</Grid>
						{/* Inventory Storage - half width */}
						<Grid size={{ xs: 12, md: 6 }}>
							<FormControl fullWidth>
								<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>
									Inventory Storage
								</FormLabel>
								<Autocomplete
									multiple
									size="small"
									options={storageLocations}
									value={selectedStorage}
									onChange={(_, newVal) => setSelectedStorage(newVal)}
									getOptionLabel={(option) => option.name}
									isOptionEqualToValue={(option, val) => option.id === val.id}
									disableCloseOnSelect
									renderOption={(props, option, { selected }) => {
										const { key, ...rest } = props;
										return (
											<li key={key} {...rest}>
												<Checkbox
													icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
													checkedIcon={<CheckBoxIcon fontSize="small" />}
													checked={selected}
												/>
												{option.name}
											</li>
										);
									}}
									renderInput={(params) => (
										<TextField
											{...params}
											placeholder="Select locations"
											sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
										/>
									)}
								/>
							</FormControl>
						</Grid>
						{/* Frequency - half width */}
						<Grid size={{ xs: 12, md: 6 }}>
							<FormControl>
								<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>
									Frequency
								</FormLabel>
								<RadioGroup
									row
									value={frequency}
									onChange={(e) => setFrequency(e.target.value as Frequency)}
								>
									<FormControlLabel
										value="monthly"
										control={<Radio size="small" />}
										label="Monthly"
									/>
									<FormControlLabel
										value="weekly"
										control={<Radio size="small" />}
										label="Weekly"
									/>
								</RadioGroup>
							</FormControl>
						</Grid>
					</Grid>
				</Box>

				{/* Vertical divider between filter columns */}
				<Divider
					orientation="vertical"
					flexItem
					sx={{ display: { xs: "none", md: "block" }, alignSelf: "stretch" }}
				/>

				{/* Right column - DateRange (40%) */}
				<Box sx={{ flex: "2 1 0%", minWidth: 250 }}>
					<Box sx={{ height: 290, overflowY: "auto" }}>
						<FormLabel sx={{ fontWeight: 500, mb: 1, display: "block" }}>
							Date Range
						</FormLabel>
						<LocalizationProvider dateAdapter={AdapterDayjs}>
							<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
								{dateRanges.map((dr, index) => (
									<Box
										key={index}
										sx={{ display: "flex", gap: 1, alignItems: "center" }}
									>
										<DatePicker
											label={`From ${dateRanges.length > 1 ? index + 1 : ""}`}
											value={dr.from}
											onChange={(v) => handleUpdateDateRange(index, "from", v)}
											slotProps={{
												textField: {
													size: "small",
													fullWidth: true,
													sx: {
														"& .MuiOutlinedInput-root": { borderRadius: 2 },
													},
												},
											}}
										/>
										<DatePicker
											label={`To ${dateRanges.length > 1 ? index + 1 : ""}`}
											value={dr.to}
											onChange={(v) => handleUpdateDateRange(index, "to", v)}
											slotProps={{
												textField: {
													size: "small",
													fullWidth: true,
													sx: {
														"& .MuiOutlinedInput-root": { borderRadius: 2 },
													},
												},
											}}
										/>
										{dateRanges.length > 1 && (
											<IconButton
												size="small"
												onClick={() => handleRemoveDateRange(index)}
												color="error"
											>
												<DeleteIcon fontSize="small" />
											</IconButton>
										)}
									</Box>
								))}
								<Button
									size="small"
									startIcon={<AddIcon />}
									onClick={handleAddDateRange}
									variant="outlined"
									sx={{ alignSelf: "flex-start" }}
								>
									Add Date Range
								</Button>
							</Box>
						</LocalizationProvider>
					</Box>
				</Box>

				{/* Apply Button - full width */}
				<Box sx={{ width: "100%" }}>
					<Box
						sx={{
							display: "flex",
							flexDirection: { xs: "column", md: "row" },
							alignItems: { xs: "flex-end", md: "center" },
							gap: 1.5,
							mt: 1,
						}}
					>
						{gridError && (
							<Alert
								severity="error"
								sx={{
									width: "100%",
									flex: { md: 1 },
									mb: 0,
									py: 0.5,
									alignSelf: "stretch",
								}}
							>
								{gridError}
							</Alert>
						)}
						{!gridError && (
							<Box sx={{ flex: 1, display: { xs: "none", md: "block" } }} />
						)}
						<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
							{isApplying && <CircularProgress size={22} thickness={2.5} />}
							{!isApplying && applied && !gridError && (
								<CheckCircleIcon sx={{ color: "success.main", fontSize: 22 }} />
							)}
							{!isApplying && gridError && (
								<CancelIcon sx={{ color: "error.main", fontSize: 22 }} />
							)}
							<Button
								variant="contained"
								startIcon={<PlayArrowIcon />}
								onClick={handleApply}
								size="large"
								disabled={isApplying}
								sx={{ borderRadius: 2, px: 4 }}
							>
								Apply
							</Button>
						</Box>
					</Box>
				</Box>
			</Box>
		</Paper>
	);

	// ─── Custom Toolbar ─────────────────────────────────────────────
	const handleExcelExport = useCallback(() => {
		exportDataGridToExcel(
			rows as Record<string, unknown>[],
			columns,
			"purchase-requirements.xlsx",
		);
	}, [rows, columns]);

	const CustomToolbar = useCallback(() => {
		const labelSx = { display: { xs: "none", md: "inline" } };
		const iconBtnSx = {
			minWidth: "auto",
			textTransform: "none",
			fontSize: "0.8125rem",
			fontWeight: 500,
			paddingLeft: 0.75,
			paddingRight: 0.75,
			color: theme.palette.primary.main,
		};
		return (
			<Box
				sx={{
					display: "flex",
					flexDirection: "column",
					borderBottom: "1px solid",
					borderColor: "divider",
				}}
			>
				{/* Top row: title + export buttons */}
				<Box
					sx={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						px: 2,
						py: 1,
					}}
				>
					<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
						Filtered Products
					</Typography>
					<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
						<ColumnsPanelTrigger
							size="small"
							startIcon={<ViewColumnIcon />}
							style={iconBtnSx}
						>
							<Box component="span" sx={labelSx}>Columns</Box>
						</ColumnsPanelTrigger>
						<FilterPanelTrigger
							size="small"
							startIcon={<FilterListIcon />}
							style={iconBtnSx}
						>
							<Box component="span" sx={labelSx}>Filters</Box>
						</FilterPanelTrigger>
						<ExportCsv
							size="small"
							startIcon={<FileDownloadIcon />}
							style={iconBtnSx}
						>
							<Box component="span" sx={labelSx}>CSV</Box>
						</ExportCsv>
						<ExportPrint
							size="small"
							startIcon={<PrintIcon />}
							style={iconBtnSx}
						>
							<Box component="span" sx={labelSx}>Print</Box>
						</ExportPrint>
						<Tooltip title="Export to Excel">
							<Button
								size="small"
								color="primary"
								startIcon={<TableChartIcon />}
								onClick={handleExcelExport}
								sx={{
									minWidth: "auto",
									textTransform: "none",
									fontSize: "0.8125rem",
									fontWeight: 500,
									px: 0.75,
								}}
							>
								<Box component="span" sx={labelSx}>Excel</Box>
							</Button>
						</Tooltip>
					</Box>
				</Box>

				{/* Bottom row: bulk factor, price class, PO reference */}
				<Box
					sx={{
						display: "flex",
						flexWrap: "wrap",
						gap: 2,
						px: 2,
						pb: 1.5,
						alignItems: "center",
					}}
				>
					<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
						<TextField
							size="small"
							type="number"
							label="Bulk Factor"
							value={bulkFactor}
							onChange={(e) => setBulkFactor(e.target.value)}
							slotProps={{
								htmlInput: { step: 0.1, min: 0.1 },
							}}
							sx={{ width: 110, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
						/>
						<Button
							size="small"
							variant="outlined"
							onClick={handleBulkFactorApply}
							sx={{ textTransform: "none", borderRadius: 2 }}
						>
							Apply
						</Button>
					</Box>

					<Autocomplete
						size="small"
						options={priceClasses}
						value={selectedPriceClass}
						onChange={(_, newVal) => setSelectedPriceClass(newVal)}
						sx={{ width: 180 }}
						renderInput={(params) => (
							<TextField
								{...params}
								label="Price Class"
								sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
							/>
						)}
					/>

					<TextField
						size="small"
						label="PO Reference No."
						value={poReference}
						onChange={(e) => setPoReference(e.target.value)}
						sx={{
							width: 200,
							"& .MuiOutlinedInput-root": { borderRadius: 2 },
						}}
					/>
				</Box>
			</Box>
		);
	}, [
		handleExcelExport,
		bulkFactor,
		handleBulkFactorApply,
		priceClasses,
		selectedPriceClass,
		poReference,
		theme.palette.primary.main,
	]);

	// ─── Persist Form State ──────────────────────────────────────────
	const persistState = useMemo(
		() => ({
			selectedPrincipal,
			selectedStorage,
			frequency,
			dateRanges: serializeDateRanges(dateRanges),
		}),
		[selectedPrincipal, selectedStorage, frequency, dateRanges],
	);

	useEffect(() => {
		persistFormState(persistState);
	}, [persistState]);

	// ─── Render ───────────────────────────────────────────────────────
	return (
		<>
			{filterPanel}

			{applied && columns.length > 0 && (
				<Paper sx={{ width: "100%", borderRadius: 2, overflow: "hidden" }}>
					<DataGrid
						rows={rows}
						columns={columns}
						editMode="row"
						processRowUpdate={processRowUpdate}
						onProcessRowUpdateError={(err) =>
							console.error("Row update error:", err)
						}
						getRowHeight={() => 42}
						slots={{ toolbar: CustomToolbar }}
						showToolbar
						initialState={{
							pagination: { paginationModel: { pageSize: 20 } },
						}}
						pageSizeOptions={[10, 20, 50]}
						checkboxSelection
						disableRowSelectionOnClick
						sx={{
							border: "none",
							"& .MuiDataGrid-columnHeader": {
								fontWeight: 600,
								fontSize: "0.8rem",
							},
							"& .MuiDataGrid-columnHeaders": {
								borderBottom: 2,
								borderColor: "divider",
							},
							"& .group-demand": {
								backgroundColor: groupColors.demand.bg,
								color: groupColors.demand.color,
							},
							"& .group-computation": {
								backgroundColor: groupColors.computation.bg,
								color: groupColors.computation.color,
							},
							"& .group-custom": {
								backgroundColor: groupColors.custom.bg,
								color: groupColors.custom.color,
							},
							"& .MuiDataGrid-cell:focus": {
								outline: "none",
							},
							"& .MuiDataGrid-cell:focus-within": {
								outline: "none",
							},
							"& .MuiDataGrid-footerContainer": {
								borderTop: "1px solid",
								borderColor: "divider",
							},
							"& .MuiDataGrid-virtualScroller": {
								minHeight: 300,
							},
						}}
						slotProps={{
							pagination: {
								labelRowsPerPage: "Rows:",
							},
						}}
					/>
				</Paper>
			)}
		</>
	);
};

export default PurchasingRequirements;
