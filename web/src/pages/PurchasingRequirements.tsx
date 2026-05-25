import React, {
	useState,
	useCallback,
	useMemo,
	useEffect,
	useRef,
} from "react";
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
	Chip,
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
import type { GridColDef, GridRowModel } from "@mui/x-data-grid";
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
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { exportDataGridToExcel } from "../utils/exportToExcel";
import apiRequest from "../services/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type Frequency = "weekly" | "monthly";

interface MinStockCategory {
	id: number;
	category_name: string;
	threshold: number | null;
}

/** All known category names in display/sort order */
const CATEGORY_NAMES = [
	"Immediate",
	"Secondary",
	"Monitoring",
	"Ordered",
	"Overstocked",
	"No record",
] as const;

/** Map category name → CSS class name for row highlighting */
const CATEGORY_CLASS_MAP: Record<string, string> = {
	Immediate: "row-immediate",
	Secondary: "row-secondary",
	Monitoring: "row-monitoring",
	Ordered: "row-ordered",
	Overstocked: "row-overstocked",
	"No record": "row-no-record",
};

/** Numeric sort order: Immediate (most urgent) first */
const CATEGORY_ORDER: Record<string, number> = {
	Immediate: 0,
	Secondary: 1,
	Monitoring: 2,
	Ordered: 3,
	Overstocked: 4,
	"No record": 5,
};

/**
 * Compute category name for a row.
 * Flat conditions (checked first, no threshold):
 *   No record — avgDemand === 0
 *   Ordered   — would be Immediate but suggestedOrder === 0 (incoming covers need)
 * Threshold-based (from SMR_MinStockCategory table):
 *   Immediate — ratio < 0.75
 *   Secondary — ratio < 1.50
 *   Monitoring — ratio < 2.00
 *   Overstocked — ratio >= 2.00 (catch-all)
 */
function computeCategoryName(
	row: {
		stockCoverCount: number | null | undefined;
		coverageThreshold: number | null | undefined;
		avgDemand: number | null | undefined;
		suggestedOrder: number | null | undefined;
	},
	categories: MinStockCategory[],
): string | null {
	// Flat condition: no demand data
	if (row.avgDemand != null && row.avgDemand === 0) {
		return "No record";
	}

	// Threshold-based categories
	if (
		!categories.length ||
		row.stockCoverCount == null ||
		row.coverageThreshold == null ||
		row.coverageThreshold <= 0
	) {
		return null;
	}

	const ratio = row.stockCoverCount / row.coverageThreshold;
	for (const cat of categories) {
		if (cat.threshold != null && ratio < cat.threshold) {
			// Flat condition: would be Immediate but incoming already covers
			if (
				cat.category_name === "Immediate" &&
				row.suggestedOrder != null &&
				row.suggestedOrder === 0
			) {
				return "Ordered";
			}
			return cat.category_name;
		}
	}

	// Overstocked catch-all
	return "Overstocked";
}

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
	avgDemandCS: number;
	stockCoverCount: number;
	coverageThreshold: number;
	suggestedOrder: number;
	suggestedOrderCS: number;
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
		Jan: 0,
		Feb: 1,
		Mar: 2,
		Apr: 3,
		May: 4,
		Jun: 5,
		Jul: 6,
		Aug: 7,
		Sep: 8,
		Oct: 9,
		Nov: 10,
		Dec: 11,
	};
	const wm = key.match(/^W(\d+)\s+(\w+)\s+(\d+)$/);
	if (wm && wm[2] && wm[3])
		return Number(wm[3]) * 60 + (monthIdx[wm[2]] ?? 0) * 5 + Number(wm[1]);
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

// ─── Custom Toolbar Component ────────────────────────────────────────────────

interface PurchasingRequirementsToolbarProps {
	handleExcelExport: () => void;
	bulkMinStock: string;
	setBulkMinStock: (val: string) => void;
	handleBulkMinStockApply: () => void;
	priceClasses: string[];
	selectedPriceClass: string | null;
	setSelectedPriceClass: (val: string | null) => void;
	categoryOptions: string[];
	selectedCategories: string[];
	setSelectedCategories: (val: string[]) => void;
	poReference: string;
	setPoReference: (val: string) => void;
	showDemandColumns: boolean;
	setShowDemandColumns: React.Dispatch<React.SetStateAction<boolean>>;
	frequency: Frequency;
	darkMode: boolean;
}

const PurchasingRequirementsToolbar: React.FC<
	PurchasingRequirementsToolbarProps
> = ({
	handleExcelExport,
	bulkMinStock,
	setBulkMinStock,
	handleBulkMinStockApply,
	priceClasses,
	selectedPriceClass,
	setSelectedPriceClass,
	categoryOptions,
	selectedCategories,
	setSelectedCategories,
	poReference,
	setPoReference,
	showDemandColumns,
	setShowDemandColumns,
	frequency,
	darkMode,
}) => {
	const theme = useTheme();

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

	// Category colors matching data grid row highlighting
	const categoryColors: Record<
		string,
		{ bg: string; chipBg: string; chipText: string }
	> = {
		Immediate: {
			bg: darkMode ? "rgba(211, 47, 47, 0.35)" : "#ffcdd2",
			chipBg: darkMode ? "#b71c1c" : "#d32f2f",
			chipText: "#ffffff",
		},
		Secondary: {
			bg: darkMode ? "rgba(255, 193, 7, 0.30)" : "#fff9c4",
			chipBg: darkMode ? "#f57f17" : "#f9a825",
			chipText: "#ffffff",
		},
		Monitoring: {
			bg: darkMode ? "rgba(33, 150, 243, 0.27)" : "#bbdefb",
			chipBg: darkMode ? "#0d47a1" : "#1976d2",
			chipText: "#ffffff",
		},
		Ordered: {
			bg: darkMode ? "rgba(156, 39, 176, 0.25)" : "#e1bee7",
			chipBg: darkMode ? "#4a148c" : "#7b1fa2",
			chipText: "#ffffff",
		},
		Overstocked: {
			bg: darkMode ? "rgba(76, 175, 80, 0.27)" : "#c8e6c9",
			chipBg: darkMode ? "#1b5e20" : "#388e3c",
			chipText: "#ffffff",
		},
		"No record": {
			bg: darkMode ? "rgba(158, 158, 158, 0.25)" : "#eceff1",
			chipBg: darkMode ? "#37474f" : "#616161",
			chipText: "#ffffff",
		},
	};
	const getCategoryColor = (cat: string) =>
		categoryColors[cat] ?? {
			bg: "transparent",
			chipBg: theme.palette.action.selected,
			chipText: theme.palette.text.primary,
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
						<Box component="span" sx={labelSx}>
							Columns
						</Box>
					</ColumnsPanelTrigger>
					<FilterPanelTrigger
						size="small"
						startIcon={<FilterListIcon />}
						style={iconBtnSx}
					>
						<Box component="span" sx={labelSx}>
							Filters
						</Box>
					</FilterPanelTrigger>
					<ExportCsv
						size="small"
						startIcon={<FileDownloadIcon />}
						style={iconBtnSx}
					>
						<Box component="span" sx={labelSx}>
							CSV
						</Box>
					</ExportCsv>
					<ExportPrint
						size="small"
						startIcon={<PrintIcon />}
						style={iconBtnSx}
					>
						<Box component="span" sx={labelSx}>
							Print
						</Box>
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
							<Box component="span" sx={labelSx}>
								Excel
							</Box>
						</Button>
					</Tooltip>
				</Box>
			</Box>

			{/* Bottom row: bulk min stock, price class, category, PO reference */}
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
						label={`Min Stock (${frequency === "weekly" ? "Weeks" : "Months"})`}
						value={bulkMinStock}
						onChange={(e) => setBulkMinStock(e.target.value)}
						slotProps={{
							htmlInput: { step: 0.1, min: 0.1 },
						}}
						sx={{
							width: 140,
							"& .MuiOutlinedInput-root": { borderRadius: 2 },
						}}
					/>
					<Button
						size="small"
						variant="outlined"
						onClick={handleBulkMinStockApply}
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

				<Autocomplete
					multiple
					size="small"
					options={categoryOptions}
					value={selectedCategories}
					onChange={(_, newVal) => setSelectedCategories(newVal)}
					disableCloseOnSelect
					sx={{ width: 220 }}
					renderValue={(value, getItemProps) =>
						(value as string[]).map((option, index) => {
							const { key, ...itemProps } = getItemProps({ index });
							const cc = getCategoryColor(option);
							return (
								<Chip
									key={key}
									{...itemProps}
									label={option}
									size="small"
									variant="filled"
									sx={{
										backgroundColor: `${cc.chipBg} !important`,
										color: `${cc.chipText} !important`,
										fontWeight: 700,
										"& .MuiChip-deleteIcon": {
											color: `${cc.chipText} !important`,
											fontSize: 18,
											opacity: 0.85,
											"&:hover": { opacity: 1 },
										},
									}}
								/>
							);
						})
					}
					renderOption={(props, option, { selected }) => {
						const { key, ...rest } = props;
						const cc = getCategoryColor(option);
						return (
							<li
								key={key}
								{...rest}
								style={{
									backgroundColor: selected ? cc.bg : undefined,
									borderLeft: `4px solid ${cc.chipBg}`,
									marginBottom: 1,
								}}
							>
								<Checkbox
									icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
									checkedIcon={<CheckBoxIcon fontSize="small" />}
									checked={selected}
									sx={{
										color: cc.chipBg,
										"&.Mui-checked": { color: cc.chipBg },
									}}
								/>
								<Typography variant="body2" sx={{ fontWeight: 500 }}>
									{option}
								</Typography>
							</li>
						);
					}}
					renderInput={(params) => (
						<TextField
							{...params}
							label="Category"
							placeholder="Filter by category"
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

				<Button
					size="small"
					variant="outlined"
					startIcon={
						showDemandColumns ? <VisibilityOffIcon /> : <VisibilityIcon />
					}
					onClick={() => setShowDemandColumns((v) => !v)}
					sx={{ textTransform: "none", borderRadius: 2, ml: "auto" }}
				>
					{showDemandColumns ? "Hide" : "Show"} Monthly Demand
				</Button>
			</Box>
		</Box>
	);
};

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
			stock: {
				bg: darkMode ? "rgba(186, 104, 200, 0.10)" : "rgba(156, 39, 176, 0.07)",
				color: darkMode ? "#ce93d8" : "#6a1b9a",
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

	const [storageLocations, setStorageLocations] = useState<StorageLocation[]>(
		[],
	);
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
	const [rows, setRows] = useState<GridRow[]>([]);
	const [columns, setColumns] = useState<GridColDef[]>([]);
	const [gridError, setGridError] = useState<string | null>(null);
	const [applied, setApplied] = useState(false);
	const [isApplying, setIsApplying] = useState(false);
	const [categories, setCategories] = useState<MinStockCategory[]>([]);
	const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
	const categoryOptions = useMemo(() => [...CATEGORY_NAMES], []);

	// Fetch categories once on mount
	useEffect(() => {
		let cancelled = false;
		apiRequest<MinStockCategory[]>("/min-stock/categories")
			.then((data) => {
				if (!cancelled) setCategories(data ?? []);
			})
			.catch(() => {
				/* non-critical */
			});
		return () => {
			cancelled = true;
		};
	}, []);

	// Toolbar states
	const [bulkMinStock, setBulkMinStock] = useState<string>("1.0");
	const [selectedPriceClass, setSelectedPriceClass] = useState<string | null>(
		null,
	);
	const [poReference, setPoReference] = useState("");

	// Toggle monthly demand columns visibility
	const [showDemandColumns, setShowDemandColumns] = useState(true);

	// Build column visibility model — hide demand columns (field starts with "pd_")
	const columnVisibilityModel = useMemo(() => {
		const model: Record<string, boolean> = {};
		if (!showDemandColumns) {
			for (const col of columns) {
				if (col.field.startsWith("pd_")) {
					model[col.field] = false;
				}
			}
		}
		return model;
	}, [showDemandColumns, columns]);

	// Ref to track period keys for column building
	const periodKeysRef = useRef<string[]>([]);
	const categoriesRef = useRef(categories);
	categoriesRef.current = categories;

	// ─── Build Columns ────────────────────────────────────────────────
	const buildColumns = useCallback(
		(periodKeys: string[]): GridColDef[] => {
			const cols: GridColDef[] = [];

			// When frequency is weekly, compute factor to convert month-based
			// coverageThreshold to weeks for display purposes.
			const displayFactor = (() => {
				if (frequency !== "weekly" || periodKeys.length === 0) return 1.0;
				const uniqueMonths = new Set(
					periodKeys.map((k) => {
						const m = k.match(/W\d+\s+(.+)/);
						return m ? m[1] : k;
					}),
				);
				const nMonths = uniqueMonths.size;
				return nMonths > 0 ? periodKeys.length / nMonths : 1.0;
			})();

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
					value != null
						? value.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})
						: "",
			});
			cols.push({
				field: "qtyOnPO",
				headerName: "Incoming",
				width: 110,
				type: "number",
				...staticHeader,
				valueFormatter: (value?: number) =>
					value != null
						? value.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})
						: "",
			});
			cols.push({
				field: "qtyOnHand",
				headerName: "On Hand",
				width: 110,
				type: "number",
				...staticHeader,
				valueFormatter: (value?: number) =>
					value != null
						? value.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})
						: "",
			});
			cols.push({
				field: "qtyAvail",
				headerName: "Available",
				width: 110,
				type: "number",
				...staticHeader,
				valueFormatter: (value?: number) =>
					value != null
						? value.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})
						: "",
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
						value != null
							? value.toLocaleString(undefined, {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
								})
							: "",
				});
			});

			// Group 3: Computation
			cols.push({
				field: "avgDemand",
				headerName: `Avg ${frequency === "monthly" ? "Monthly" : "Weekly"} (PCS)`,
				width: 150,
				type: "number",
				headerClassName: "group-computation",
				valueFormatter: (value?: number) =>
					value != null
						? value.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})
						: "",
			});
			cols.push({
				field: "avgDemandCS",
				headerName: `Avg ${frequency === "monthly" ? "Monthly" : "Weekly"} (CS)`,
				width: 120,
				type: "number",
				headerClassName: "group-computation",
				description: "Average demand converted to cases (CS)",
				valueFormatter: (value?: number) =>
					value != null
						? value.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})
						: "",
			});
			cols.push({
				field: "coverageThreshold",
				headerName: `Min Stock (${frequency === "weekly" ? "Weeks" : "Months"})`,
				width: 100,
				type: "number",
				editable: true,
				headerClassName: "group-computation",
				renderEditCell: (params) => {
					const editDisplayValue =
						frequency === "weekly" && params.value != null
							? (Number(params.value) * displayFactor).toFixed(2)
							: (params.value ?? "");
					return (
					<input
						type="number"
						step={0.1}
						value={editDisplayValue}
						onChange={(e) => {
							const rawVal = parseFloat(e.target.value);
							if (!isNaN(rawVal)) {
								const monthsVal =
									frequency === "weekly"
										? rawVal / displayFactor
										: rawVal;
								params.api.setEditCellValue({
									id: params.id,
									field: params.field,
									value: monthsVal,
								});
							}
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
				);
				},
				valueFormatter: (value?: number) => {
					if (value == null) return "";
					const displayValue =
						frequency === "weekly" ? value * displayFactor : value;
					return displayValue.toFixed(2);
				},
			});
			cols.push({
				field: "stockCoverCount",
				headerName: `Stock Cover (${frequency === "monthly" ? "Months" : "Weeks"})`,
				width: 130,
				type: "number",
				headerClassName: "group-stock",
				valueFormatter: (value?: number) =>
					value != null ? value.toFixed(2) : "",
			});
			cols.push({
				field: "suggestedOrder",
				headerName: "Suggested Order (PCS)",
				width: 180,
				type: "number",
				headerClassName: "group-stock",
				description:
					"Stock-aware: fills up to the resolved min stock threshold (per-item coverage)",
				valueFormatter: (value?: number) =>
					value != null
						? value.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})
						: "",
			});
			cols.push({
				field: "suggestedOrderCS",
				headerName: `Suggested Order (CS)`,
				width: 130,
				type: "number",
				headerClassName: "group-stock",
				description: "Suggested order converted to cases (CS)",
				valueFormatter: (value?: number) =>
					value != null
						? value.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})
						: "",
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
					value != null
						? value.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})
						: "",
			});

			// Group 5: Category (with custom sort order)
			cols.push({
				field: "_category",
				headerName: "Category",
				width: 130,
				valueGetter: (_value: unknown, row: GridRow) =>
					computeCategoryName(row, categoriesRef.current),
				sortComparator: (v1: string | null, v2: string | null) => {
					const o1 = v1 ? CATEGORY_ORDER[v1] ?? 99 : 99;
					const o2 = v2 ? CATEGORY_ORDER[v2] ?? 99 : 99;
					return o1 - o2;
				},
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

	// ─── Bulk min stock update (principal-level) ────────────────────
	const handleBulkMinStockApply = useCallback(async () => {
		const raw = parseFloat(bulkMinStock);
		if (isNaN(raw) || raw <= 0 || !selectedPrincipal) return;

		// Convert from display unit (weeks when weekly) to months for DB storage
		const monthToWeekFactor =
			frequency === "weekly" && periodKeysRef.current.length > 0
				? (() => {
						const uniqueMonths = new Set(
							periodKeysRef.current.map((k) => {
								const m = k.match(/W\d+\s+(.+)/);
								return m ? m[1] : k;
							}),
						);
						const nMonths = uniqueMonths.size;
						return nMonths > 0
							? periodKeysRef.current.length / nMonths
							: 1.0;
					})()
				: 1.0;
		const val = frequency === "weekly" ? raw / monthToWeekFactor : raw;

		setIsApplying(true);
		setGridError(null);
		try {
			// Find existing principal min stock record
			let principalId: number | null = null;
			try {
				const existing = await apiRequest<{ id: number }>(
					`/min-stock/principals/class/${selectedPrincipal.ClassID}`,
				);
				principalId = existing.id;
			} catch {
				// No existing record — will create
			}

			if (principalId) {
				await apiRequest(`/min-stock/principals/${principalId}`, {
					method: "PUT",
					body: { min_stock: val },
				});
			} else {
				await apiRequest("/min-stock/principals", {
					method: "POST",
					body: { class_id: selectedPrincipal.ClassID, min_stock: val },
				});
			}

			// After updating principal-level min stock, re-fetch data
			// so the backend re-resolves coverageThreshold for all items
			await handleApply();
		} catch (err: unknown) {
			setGridError(
				err instanceof Error
					? err.message
					: "Failed to update principal min stock.",
			);
		} finally {
			setIsApplying(false);
		}
	}, [bulkMinStock, selectedPrincipal, handleApply]);

	// ─── Grid Edit Handler ────────────────────────────────────────────
	const processRowUpdate = useCallback(
		async (newRow: GridRowModel, oldRow: GridRowModel) => {
			const updatedRow = { ...newRow } as GridRow;

			if (newRow.coverageThreshold !== oldRow.coverageThreshold) {
				// Save as Custom item-level min stock via API
				// If this fails, the error throws and the DataGrid reverts the edit
				// 1. Set the setting to 'Custom'
				await apiRequest(`/min-stock/settings/${newRow.invtID}`, {
					method: "PATCH",
					body: { min_stock_setting: "Custom" },
				});

				// 2. Create or update the item-level min stock value
				let itemId: number | null = null;
				try {
					const existing = await apiRequest<{ id: number }>(
						`/min-stock/items/invt/${newRow.invtID}`,
					);
					itemId = existing.id;
				} catch {
					// No existing record — will create
				}

				if (itemId) {
					await apiRequest(`/min-stock/items/${itemId}`, {
						method: "PUT",
						body: { min_stock: newRow.coverageThreshold },
					});
				} else {
					await apiRequest("/min-stock/items", {
						method: "POST",
						body: {
							inventory_id: newRow.invtID,
							min_stock: newRow.coverageThreshold,
						},
					});
				}

				// Recalculate locally to match backend logic in purchasing.service.ts.
				// Backend: suggestedMonthlyOrder = avgDemand (period baseline, not threshold-scaled),
				// targetStock = effectiveThreshold × avgDemand.
				// When frequency is weekly, coverageThreshold (stored as months) is converted
				// to weeks using the actual period ratio from the date range.
				const monthToWeekFactor = (() => {
					if (frequency !== "weekly") return 1.0;
					const pKeys = periodKeysRef.current;
					if (pKeys.length === 0) return 1.0;
					const uniqueMonths = new Set(
						pKeys.map((k) => {
							const m = k.match(/W\d+\s+(.+)/);
							return m ? m[1] : k;
						}),
					);
					const nMonths = uniqueMonths.size;
					return nMonths > 0 ? pKeys.length / nMonths : 1.0;
				})();
				const effectiveThreshold = newRow.coverageThreshold * monthToWeekFactor;
				const targetStock = effectiveThreshold * newRow.avgDemand;
				updatedRow.suggestedOrder = Math.max(
					0,
					Math.round((targetStock - newRow.qtyAvail - newRow.qtyOnPO) * 100) /
						100,
				);
			}

			if (newRow.customOrder === "" || newRow.customOrder === null) {
				updatedRow.customOrder = null;
			}

			setRows((prev: GridRow[]) =>
				prev.map((r: GridRow) =>
					(r as GridRow).id === newRow.id ? updatedRow : r,
				),
			);

			return updatedRow;
		},
		[frequency],
	);

	// ─── Row category class ────────────────────────────────────────────
	const getRowClassName = useCallback(
		(params: { row: GridRow }): string => {
			const cat = computeCategoryName(params.row, categories);
			return cat ? CATEGORY_CLASS_MAP[cat] ?? "" : "";
		},
		[categories],
	);

	// ─── Filtered rows by selected categories ──────────────────────────
	const filteredRows = useMemo(() => {
		if (selectedCategories.length === 0) return rows;
		return rows.filter((row) => {
			const cat = computeCategoryName(row, categories);
			return cat ? selectedCategories.includes(cat) : true;
		});
	}, [rows, selectedCategories, categories]);

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
			filteredRows as unknown as Record<string, unknown>[],
			columns,
			"purchase-requirements.xlsx",
		);
	}, [filteredRows, columns]);

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
						rows={filteredRows}
						columns={columns}
						columnVisibilityModel={columnVisibilityModel}
						getRowClassName={getRowClassName}
						editMode="row"
						processRowUpdate={processRowUpdate}
						onProcessRowUpdateError={(err) => {
							const msg =
								err instanceof Error
									? err.message
									: "Failed to save min stock for item.";
							console.error("Row update error:", msg);
							setGridError(msg);
						}}
						getRowHeight={() => 42}
						showToolbar
						initialState={{
							pagination: { paginationModel: { pageSize: 20 } },
							sorting: {
								sortModel: [{ field: "_category", sort: "asc" }],
							},
						}}
						pageSizeOptions={[10, 20, 50]}
						checkboxSelection
						disableRowSelectionOnClick
						slots={{ toolbar: PurchasingRequirementsToolbar as React.ComponentType<any> }}
						slotProps={{
							toolbar: {
								handleExcelExport,
								bulkMinStock,
								setBulkMinStock,
								handleBulkMinStockApply,
								priceClasses,
								selectedPriceClass,
								setSelectedPriceClass,
								categoryOptions,
								selectedCategories,
								setSelectedCategories,
								poReference,
								setPoReference,
								showDemandColumns,
								setShowDemandColumns,
								frequency,
								darkMode,
							} as any,
							pagination: {
								labelRowsPerPage: "Rows:",
							},
						}}
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
							"& .group-stock": {
								backgroundColor: groupColors.stock.bg,
								color: groupColors.stock.color,
							},
						// Row category colours (stock cover vs min stock ratio)
						"& .row-immediate": {
							backgroundColor: darkMode
								? "rgba(211, 47, 47, 0.35)"
								: "#ffcdd2",
							borderLeft: "5px solid #d32f2f",
						},
						"& .row-secondary": {
							backgroundColor: darkMode
								? "rgba(255, 193, 7, 0.30)"
								: "#fff9c4",
							borderLeft: "5px solid #f9a825",
						},
						"& .row-monitoring": {
							backgroundColor: darkMode
								? "rgba(33, 150, 243, 0.27)"
								: "#bbdefb",
							borderLeft: "5px solid #1976d2",
						},
						"& .row-overstocked": {
							backgroundColor: darkMode
								? "rgba(76, 175, 80, 0.27)"
								: "#c8e6c9",
							borderLeft: "5px solid #388e3c",
						},
"& .row-ordered": {
						backgroundColor: darkMode
							? "rgba(156, 39, 176, 0.25)"
							: "#e1bee7",
						borderLeft: "5px solid #7b1fa2",
					},
						"& .row-no-record": {
							backgroundColor: darkMode
								? "rgba(158, 158, 158, 0.25)"
								: "#eceff1",
							borderLeft: "5px solid #616161",
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
					/>
				</Paper>
			)}
		</>
	);
};

export default PurchasingRequirements;
