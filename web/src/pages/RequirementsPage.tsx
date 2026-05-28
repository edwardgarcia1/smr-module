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
	Stack,
	ToggleButton,
	ToggleButtonGroup,
	useTheme,
} from "@mui/material";
import { useThemeMode } from "../providers/AppProvider";
import {
	DataGrid,
	ColumnsPanelTrigger,
	FilterPanelTrigger,
	ExportPrint,
	useGridApiRef,
} from "@mui/x-data-grid";
import type {
	GridColDef,
	GridRowModel,
	GridColumnGroupingModel,
} from "@mui/x-data-grid";
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
import PrintIcon from "@mui/icons-material/Print";
import TableChartIcon from "@mui/icons-material/TableChart";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { exportDataGridToExcel } from "../utils/exportToExcel";
import apiRequest from "../services/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type Mode = "purchasing" | "bundling";
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

/** Map category name → Excel fill color (6-char hex, no `#`, no alpha) */
const CAT_EXCEL_COLORS: Record<string, string> = {
	Immediate: "ffcdd2",
	Secondary: "fff9c4",
	Monitoring: "bbdefb",
	Ordered: "e1bee7",
	Overstocked: "c8e6c9",
	"No record": "eceff1",
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
	/** Month-to-week factor: 1.0 for monthly, >1 for weekly. Converts coverageThreshold to weeks so units match stockCoverCount. */
	displayFactor?: number,
): string | null {
	if (row.avgDemand != null && row.avgDemand === 0) {
		return "No record";
	}
	if (
		!categories.length ||
		row.stockCoverCount == null ||
		row.coverageThreshold == null ||
		row.coverageThreshold <= 0
	) {
		return null;
	}

	// Normalize coverageThreshold to same time unit as stockCoverCount.
	//   monthly: coverageThreshold (months) × 1.0 = months  ✓  (stockCoverCount is in months)
	//   weekly:  coverageThreshold (months) × factor = weeks  ✓  (stockCoverCount is in weeks)
	const effectiveThreshold =
		displayFactor != null && displayFactor !== 1
			? row.coverageThreshold * displayFactor
			: row.coverageThreshold;
	const ratio = row.stockCoverCount / effectiveThreshold;
	for (const cat of categories) {
		if (cat.threshold != null && ratio < cat.threshold) {
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

// ─── Purchasing Row Types ────────────────────────────────────────────────────

interface RequirementRow {
	invtID: string;
	descr: string;
	stkUnit: string;
	qtyPerCS: number;
	classID: string;
	qtyOnHand: number;
	qtyAvail: number;
	qtyOnPO: number;
	qtyAlloc: number;
	periodDemand: Record<string, number>;
	avgDemand: number;
	avgDemandCS: number;
	totalDemandCS: number;
	stockCoverCount: number;
	coverageThreshold: number;
	suggestedOrder: number;
	suggestedOrderCS: number;
	customOrder: number | null;
	amount: number | null;
	// Price fields for column groups
	listPrice_ao?: string;
	listPrice_perCS?: number;
	listPrice_perStkUnit?: number;
	costPrice_ao?: string;
	costPrice_perCS?: number;
	costPrice_perStkUnit?: number;
}

// ─── Bundling Row Types ──────────────────────────────────────────────────────

interface ComponentStock {
	cmpnentID: string;
	descr: string;
	stkUnit: string;
	qtyPerBundle: number;
	qtyOnHand: number;
	qtyAvail: number;
	qtyOnPO: number;
	qtyAlloc: number;
	maxBundlesFromStock: number;
}

interface BundlingRow {
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
	coverageThreshold: number | null;
	suggestedOrder: number | null;
	components: ComponentStock[];
	bundlableQuantity: number;
	suggestedBundles: number;
	canFulfillFromBundling: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_SITE_IDS = new Set(["MAIN", "CAB", "3MPMT", "3MPGT"]);

/** Numeric sort value for period labels */
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

const FORM_STORAGE_KEY = "requirements-form-state-v1";

interface PersistedFormState {
	mode: Mode;
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

// ─── Component Cell Renderers (Bundling) ─────────────────────────────────────

const ComponentChip: React.FC<{ component: ComponentStock }> = ({
	component,
}) => {
	const shortage = component.maxBundlesFromStock < 1;
	return (
		<Box
			sx={{
				display: "inline-flex",
				alignItems: "center",
				gap: 0.75,
				bgcolor: shortage ? "error.soft" : "success.soft",
				border: 1,
				borderColor: shortage ? "error.light" : "success.light",
				borderRadius: 1,
				px: 1,
				py: 0.25,
				fontSize: "0.75rem",
				whiteSpace: "nowrap",
			}}
			title={`${component.cmpnentID} — ${component.descr}\nAvailable: ${component.qtyAvail}\nQty per bundle: ${component.qtyPerBundle}\nMax bundles: ${component.maxBundlesFromStock}`}
		>
			<Typography
				component="span"
				variant="caption"
				sx={{ fontWeight: 600, fontSize: "0.7rem", color: "text.primary" }}
			>
				{component.cmpnentID}
			</Typography>
			<Typography
				component="span"
				variant="caption"
				sx={{ fontSize: "0.65rem", color: "text.secondary" }}
			>
				{component.qtyAvail} avail / {component.qtyPerBundle} ea
			</Typography>
			<Chip
				size="small"
				label={`x${component.maxBundlesFromStock}`}
				variant="outlined"
				color={shortage ? "error" : "success"}
				sx={{ height: 16, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.5 } }}
			/>
		</Box>
	);
};

const ComponentsListCell: React.FC<{ components: ComponentStock[] }> = ({
	components,
}) => {
	if (!components || components.length === 0)
		return (
			<Typography variant="caption" color="text.disabled">
				—
			</Typography>
		);
	return (
		<Stack
			direction="row"
			spacing={0.5}
			sx={{ flexWrap: "wrap", gap: 0.5, py: 0.5 }}
		>
			{components.map((c) => (
				<ComponentChip key={c.cmpnentID} component={c} />
			))}
		</Stack>
	);
};

// ─── Main Component ──────────────────────────────────────────────────────────

const RequirementsPage: React.FC = () => {
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

	// ─── Mode toggle ──────────────────────────────────────────────────
	const [mode, setMode] = useState<Mode>(persistedForm?.mode ?? "purchasing");

	// Theme-aware group colors
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
			inventory: {
				bg: darkMode ? "rgba(255, 235, 59, 0.12)" : "rgba(255, 193, 7, 0.10)",
				color: darkMode ? "#fff176" : "#f57f17",
			},
			custom: {
				bg: darkMode ? "rgba(129, 199, 132, 0.10)" : "rgba(76, 175, 80, 0.07)",
				color: darkMode ? "#81c784" : "#2e7d32",
			},
			bundling: {
				bg: darkMode ? "rgba(129, 199, 132, 0.10)" : "rgba(76, 175, 80, 0.07)",
				color: darkMode ? "#81c784" : "#2e7d32",
			},
			component: {
				bg: darkMode ? "rgba(186, 104, 200, 0.10)" : "rgba(156, 39, 176, 0.07)",
				color: darkMode ? "#ce93d8" : "#6a1b9a",
			},
			price: {
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
	const [monthlyValidDays, setMonthlyValidDays] = useState<
		Record<string, number>
	>({});
	const monthlyKeys = useMemo(
		() => Object.keys(monthlyValidDays).sort(),
		[monthlyValidDays],
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
	const [purchasingRows, setPurchasingRows] = useState<GridRowModel[]>([]);
	const [bundlingRows, setBundlingRows] = useState<GridRowModel[]>([]);
	const [purchasingColumns, setPurchasingColumns] = useState<GridColDef[]>([]);
	const [bundlingColumns, setBundlingColumns] = useState<GridColDef[]>([]);
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

	// ─── Compute per-month valid days from date ranges (weekly only) ──
	useEffect(() => {
		if (frequency !== "weekly") {
			setMonthlyValidDays({});
			return;
		}
		const monthSet = new Set<string>();
		for (const dr of dateRanges) {
			if (!dr.from || !dr.to) continue;
			let current = dr.from.startOf("month");
			while (current.isBefore(dr.to) || current.isSame(dr.to, "month")) {
				monthSet.add(current.format("YYYY-MM"));
				current = current.add(1, "month");
			}
		}
		const sortedMonths = Array.from(monthSet).sort();
		setMonthlyValidDays((prev) => {
			const next: Record<string, number> = {};
			for (const m of sortedMonths) {
				if (prev[m] != null) {
					next[m] = prev[m]; // preserve user edits
				} else {
					const start = dayjs(m + "-01");
					const daysInMonth = start.daysInMonth();
					let sundays = 0;
					for (let d = 1; d <= daysInMonth; d++) {
						if (start.date(d).day() === 0) sundays++;
					}
					next[m] = daysInMonth - sundays;
				}
			}
			return next;
		});
	}, [frequency, dateRanges]);

	// Toolbar states (purchasing-specific)
	const [bulkMinStock, setBulkMinStock] = useState<string>("1.0");
	const [selectedPriceClass, setSelectedPriceClass] = useState<string | null>(
		"CP1",
	);
	const [poReference, setPoReference] = useState("");
	const [showDemandColumns, setShowDemandColumns] = useState(true);

	// apiRef for programmatic grid access (column visibility, etc.)
	const apiRef = useGridApiRef();

	// Ref to track period keys for column building
	const periodKeysRef = useRef<string[]>([]);
	const [periodKeys, setPeriodKeys] = useState<string[]>([]);
	// State for month-to-week conversion factor (updated in handleApply)
	const [displayFactor, setDisplayFactor] = useState(1.0);
	const displayFactorRef = useRef(1.0);
	const categoriesRef = useRef(categories);

	// Ref for auto-scroll to results after apply
	const resultsAnchorRef = useRef<HTMLDivElement>(null);

	// Sync categoriesRef with current categories value outside render
	useEffect(() => {
		categoriesRef.current = categories;
	}, [categories]);

	// ─── Build Purchasing Columns ──────────────────────────────────────
	const buildPurchasingColumns = useCallback(
		(periodKeys: string[], df: number): GridColDef[] => {
			const cols: GridColDef[] = [];

			const displayFactor = df;

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
				field: "qtyPerCS",
				headerName: "Qty/CS",
				width: 90,
				type: "number",
				...staticHeader,
				description: "Conversion factor from Stock Unit to CS (CnvFact from INUnit)",
				valueFormatter: (value?: number) =>
					value != null ? value.toLocaleString(undefined, {
						minimumFractionDigits: 4,
						maximumFractionDigits: 4,
					}) : "—",
			});

			// ── Price columns: List Price (CP1) ──────────────────────────
			const priceHeader = { headerClassName: "group-price" };
			const priceFormatter = (value?: number) =>
				value != null
					? value.toLocaleString(undefined, {
							minimumFractionDigits: 2,
							maximumFractionDigits: 4,
						})
					: "—";
			const aoFormatter = (value?: string) => {
				if (!value) return "—";
				try {
					const d = new Date(value);
					return d.toLocaleString(undefined, {
						year: "numeric",
						month: "short",
						day: "numeric",
						hour: "2-digit",
						minute: "2-digit",
					});
				} catch {
					return value;
				}
			};

			cols.push({
				field: "listPrice_ao",
				headerName: "Last Update",
				width: 150,
				...priceHeader,
				valueGetter: (_value, row) =>
					(row as RequirementRow).listPrice_ao,
				valueFormatter: aoFormatter,
			});
			cols.push({
				field: "listPrice_perCS",
				headerName: "Per CS",
				width: 110,
				type: "number",
				...priceHeader,
				valueGetter: (_value, row) =>
					(row as RequirementRow).listPrice_perCS,
				valueFormatter: priceFormatter,
			});
			cols.push({
				field: "listPrice_perStkUnit",
				headerName: "Per StkUnit",
				width: 110,
				type: "number",
				...priceHeader,
				valueGetter: (_value, row) =>
					(row as RequirementRow).listPrice_perStkUnit,
				valueFormatter: priceFormatter,
			});

			// ── Price columns: Price (Cost) ───────────────────────────
			cols.push({
				field: "costPrice_ao",
				headerName: "Last Update",
				width: 150,
				...priceHeader,
				valueGetter: (_value, row) =>
					(row as RequirementRow).costPrice_ao,
				valueFormatter: aoFormatter,
			});
			cols.push({
				field: "costPrice_perCS",
				headerName: "Per CS",
				width: 110,
				type: "number",
				...priceHeader,
				valueGetter: (_value, row) =>
					(row as RequirementRow).costPrice_perCS,
				valueFormatter: priceFormatter,
			});
			cols.push({
				field: "costPrice_perStkUnit",
				headerName: "Per StkUnit",
				width: 110,
				type: "number",
				...priceHeader,
				valueGetter: (_value, row) =>
					(row as RequirementRow).costPrice_perStkUnit,
				valueFormatter: priceFormatter,
			});

			cols.push({
				field: "qtyAlloc",
				headerName: "Unreleased",
				width: 110,
				type: "number",
				headerClassName: "group-inventory",
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
				headerClassName: "group-inventory",
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
				headerClassName: "group-inventory",
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
				headerClassName: "group-inventory",
				valueFormatter: (value?: number) =>
					value != null
						? value.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})
						: "",
			});

			// Demand columns
			periodKeys.forEach((key) => {
				const fieldKey = `pd_${key.replace(/[\s]/g, "_")}`;
				cols.push({
					field: fieldKey,
					headerName: key,
					width: 110,
					type: "number",
					headerClassName: "group-demand",
					valueGetter: (_value, row) =>
						(row as unknown as RequirementRow & { id: number }).periodDemand[
							key
						] ?? 0,
					valueFormatter: (value?: number) =>
						value != null
							? value.toLocaleString(undefined, {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
								})
							: "",
				});
			});

			// Computation columns
			cols.push({
				field: "totalDemand",
				headerName: "Total",
				width: 110,
				type: "number",
				headerClassName: "group-computation",
				valueGetter: (_value, row) => {
					const r = row as RequirementRow;
					return Object.values(r.periodDemand ?? {}).reduce(
						(sum, v) => sum + v,
						0,
					);
				},
				valueFormatter: (value?: number) =>
					value != null
						? value.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})
						: "",
			});
			cols.push({
				field: "totalDemandCS",
				headerName: "Total (CS)",
				width: 110,
				type: "number",
				headerClassName: "group-computation",
				valueGetter: (_value, row) =>
					(row as RequirementRow).totalDemandCS,
				valueFormatter: (value?: number) =>
					value != null
						? value.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})
						: "",
			});
			cols.push({
				field: "avgDemand",
				headerName: 			`Avg ${frequency === "monthly" ? "Monthly" : "Weekly"}`,
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
				field: "stockCoverCount",
				headerName: `Stock Cover (${frequency === "monthly" ? "Months" : "Weeks"})`,
				width: 130,
				type: "number",
				headerClassName: "group-computation",
				valueFormatter: (value?: number) =>
					value != null ? value.toFixed(2) : "",
			});
			cols.push({
				field: "coverageThreshold",
				headerName: `Min Stock (${frequency === "weekly" ? "Weeks" : "Months"})`,
				width: 100,
				type: "number",
				editable: true,
				headerClassName: "group-stock",
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
										frequency === "weekly" ? rawVal / displayFactor : rawVal;
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
				field: "suggestedOrder",
				headerName: "Suggested Order",
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
				headerName: "Suggested Order (CS)",
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

			// Custom Order
			cols.push({
				field: "customOrder",
				headerName: "Custom Order (CS)",
				width: 130,
				type: "number",
				editable: true,
				headerClassName: "group-stock",
				valueFormatter: (value?: number) =>
					value != null
						? value.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})
						: "",
			});

			// Amount
			cols.push({
				field: "amount",
				headerName: "Amount",
				width: 130,
				type: "number",
				headerClassName: "group-stock",
				description:
					"Order amount: customOrder × List Price per CS, or suggestedOrderCS × List Price per CS",
				valueGetter: (_value: unknown, row: RequirementRow) => {
					const qty =
						row.customOrder != null
							? row.customOrder
							: row.suggestedOrderCS;
					const price = row.listPrice_perCS;
					if (price == null) return null;
					return Math.round(qty * price * 100) / 100;
				},
				valueFormatter: (value?: number | null) =>
					value != null
						? value.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})
						: "—",
			});

			// Category
			cols.push({
				field: "_category",
				headerName: "Category",
				width: 130,
				valueGetter: (_value: unknown, row: RequirementRow) =>
					computeCategoryName(row, categoriesRef.current, displayFactor),
				sortComparator: (v1: string | null, v2: string | null) => {
					const o1 = v1 ? (CATEGORY_ORDER[v1] ?? 99) : 99;
					const o2 = v2 ? (CATEGORY_ORDER[v2] ?? 99) : 99;
					return o1 - o2;
				},
			});
			return cols;
		},
		[frequency],
	);

	// ─── Build Bundling Columns ────────────────────────────────────────
	const buildBundlingColumns = useCallback(
		(periodKeys: string[], df: number): GridColDef[] => {
			const cols: GridColDef[] = [];

			const staticHeader = { headerClassName: "group-static" };
			cols.push({
				field: "invtID",
				headerName: "Promo ID",
				width: 120,
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

			// Bundling status badge
			cols.push({
				field: "canFulfillFromBundling",
				headerName: "Bundle?",
				width: 90,
				headerClassName: "group-bundling",
				renderCell: (params) => {
					const row = params.row as BundlingRow & { id: number };
					return row.canFulfillFromBundling ? (
						<Chip
							size="small"
							label="Yes"
							color="success"
							variant="outlined"
							sx={{ fontWeight: 600, fontSize: "0.7rem" }}
						/>
					) : (
						<Chip
							size="small"
							label="No"
							color="warning"
							variant="outlined"
							sx={{ fontWeight: 600, fontSize: "0.7rem" }}
						/>
					);
				},
			});
			cols.push({
				field: "bundlableQuantity",
				headerName: "Bundlable Qty",
				width: 120,
				type: "number",
				headerClassName: "group-bundling",
				valueFormatter: (value?: number) =>
					value != null ? value.toLocaleString() : "",
			});
			cols.push({
				field: "suggestedBundles",
				headerName: "Suggested Bundles",
				width: 130,
				type: "number",
				headerClassName: "group-bundling",
				valueFormatter: (value?: number) =>
					value != null ? value.toLocaleString() : "",
			});

			// Components column
			cols.push({
				field: "components",
				headerName: "Components (avail / per bundle)",
				width: 700,
				minWidth: 500,
				flex: 1,
				headerClassName: "group-component",
				sortable: false,
				filterable: false,
				renderCell: (params) => {
					const row = params.row as BundlingRow & { id: number };
					return <ComponentsListCell components={row.components ?? []} />;
				},
			});

			cols.push({
				field: "qtyAlloc",
				headerName: "Unreleased",
				width: 110,
				type: "number",
				headerClassName: "group-inventory",
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
				headerClassName: "group-inventory",
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
				headerClassName: "group-inventory",
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
				headerClassName: "group-inventory",
				valueFormatter: (value?: number) =>
					value != null
						? value.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})
						: "",
			});

			// Demand columns
			periodKeys.forEach((key) => {
				const fieldKey = `pd_${key.replace(/[\s]/g, "_")}`;
				cols.push({
					field: fieldKey,
					headerName: key,
					width: 110,
					type: "number",
					headerClassName: "group-demand",
					valueGetter: (_value, row) =>
						(row as unknown as BundlingRow & { id: number }).periodDemand[
							key
						] ?? 0,
					valueFormatter: (value?: number) =>
						value != null
							? value.toLocaleString(undefined, {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
								})
							: "",
				});
			});

			// Computation columns
			cols.push({
				field: "avgDemand",
				headerName: `Avg ${frequency === "monthly" ? "Monthly" : "Weekly"} Demand`,
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
				field: "stockCoverCount",
				headerName: `Stock Cover (${frequency === "monthly" ? "Months" : "Weeks"})`,
				width: 130,
				type: "number",
				headerClassName: "group-computation",
				valueFormatter: (value?: number) =>
					value != null ? value.toFixed(2) : "",
			});

			// Category
			cols.push({
				field: "_category",
				headerName: "Category",
				width: 130,
				valueGetter: (_value: unknown, row: BundlingRow) =>
					computeCategoryName(row, categoriesRef.current, df),
				sortComparator: (v1: string | null, v2: string | null) => {
					const o1 = v1 ? (CATEGORY_ORDER[v1] ?? 99) : 99;
					const o2 = v2 ? (CATEGORY_ORDER[v2] ?? 99) : 99;
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
		setPurchasingRows([]);
		setBundlingRows([]);
		setPurchasingColumns([]);
		setBundlingColumns([]);
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
			const params = new URLSearchParams();
			params.set("classID", selectedPrincipal.ClassID);
			params.set("frequency", frequency);
			if (frequency === "weekly") {
				const totalVD = Object.values(monthlyValidDays).reduce(
					(s, v) => s + v,
					0,
				);
				if (totalVD > 0) {
					params.set("validDays", String(totalVD));
					params.set("monthlyValidDays", JSON.stringify(monthlyValidDays));
				}
			}

			for (const dr of dateRanges) {
				if (dr.from && dr.to) {
					// With month/year picker, from is 1st of month; extend to to end of month
					params.append(
						"dateRange",
						`${dr.from.startOf("month").format("YYYY-MM-DD")},${dr.to.endOf("month").format("YYYY-MM-DD")}`,
					);
				}
			}
			for (const s of selectedStorage) {
				params.append("siteID", s.id);
			}

			const endpoint =
				mode === "purchasing"
					? "/purchasing/requirements"
					: "/bundling/requirements";
			const data = await apiRequest<RequirementRow[] | BundlingRow[]>(
				`${endpoint}?${params.toString()}`,
			);

			if (!data || data.length === 0) {
				setGridError(
					mode === "purchasing"
						? "No data matches the selected filters. Try adjusting your criteria."
						: "No promo items match the selected filters. Try adjusting your criteria.",
				);
				setIsApplying(false);
				return;
			}

			const periodKeys = Object.keys(data[0].periodDemand ?? {}).sort(
				(a, b) => periodSortValue(a) - periodSortValue(b),
			);
			periodKeysRef.current = periodKeys;
			setPeriodKeys(periodKeys);

			// Compute month-to-week conversion factor for category computation.
			// Uses working-weeks formula when validDays is available (weekly mode),
			// matching the backend's monthToWeekFactor.
			//
			// ⚠️ KEEP IN SYNC with backend monthToWeekFactor in
			//    api/src/modules/purchasing/purchasing.service.ts.
			//    Both compute: (totalVD / 6) / nMonths.
			const totalVD = Object.values(monthlyValidDays).reduce(
				(s, v) => s + v,
				0,
			);
			const df =
				frequency !== "weekly" || periodKeys.length === 0 || totalVD === 0
					? 1.0
					: (() => {
							const uniqueMonths = new Set(
								periodKeys.map((k) => {
									const m = k.match(/W\d+\s+(.+)/);
									return m ? m[1] : k;
								}),
							);
							const nMonths = uniqueMonths.size;
							return nMonths > 0 ? (totalVD / 6) / nMonths : 1.0;
						})();
			setDisplayFactor(df);
			displayFactorRef.current = df;

			const gridRows = data.map((item, idx) => ({ ...item, id: idx + 1 }));

			// Price data is now enriched server-side in the /purchasing/requirements endpoint.
			// No separate /price API calls needed.

			if (mode === "purchasing") {
				const dynamicCols = buildPurchasingColumns(periodKeys, df);
				setPurchasingColumns(dynamicCols);
				setPurchasingRows(gridRows);
			} else {
				const dynamicCols = buildBundlingColumns(periodKeys, df);
				setBundlingColumns(dynamicCols);
				setBundlingRows(gridRows);
			}
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
	}, [
		selectedPrincipal,
		selectedStorage,
		dateRanges,
		frequency,
		monthlyValidDays,
		mode,
		buildPurchasingColumns,
		buildBundlingColumns,
	]);

	// ─── Bulk min stock update (purchasing only) ──────────────────────
	const handleBulkMinStockApply = useCallback(async () => {
		const raw = parseFloat(bulkMinStock);
		if (isNaN(raw) || raw <= 0 || !selectedPrincipal) return;

		const factor = frequency === "weekly" ? displayFactorRef.current : 1.0;
		const val = frequency === "weekly" ? raw / factor : raw;

		setIsApplying(true);
		setGridError(null);
		try {
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
	}, [bulkMinStock, selectedPrincipal, frequency, handleApply]);

	// ─── Grid Edit Handler (purchasing only) ──────────────────────────
	const processRowUpdate = useCallback(
		async (newRow: GridRowModel, oldRow: GridRowModel) => {
			const updatedRow = { ...newRow };

			if (newRow.coverageThreshold !== oldRow.coverageThreshold) {
				await apiRequest(`/min-stock/settings/${newRow.invtID}`, {
					method: "PATCH",
					body: { min_stock_setting: "Custom" },
				});

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

				const effectiveThreshold =
					newRow.coverageThreshold * displayFactorRef.current;
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

			setPurchasingRows((prev) =>
				prev.map((r) => (r.id === newRow.id ? updatedRow : r)),
			);

			return updatedRow;
		},
		[frequency],
	);

	// ─── Row category class (purchasing only) ─────────────────────────
	const getRowClassName = useCallback(
		(params: { row: GridRowModel }): string => {
			const cat = computeCategoryName(
				params.row as RequirementRow,
				categories,
				displayFactor,
			);
			return cat ? (CATEGORY_CLASS_MAP[cat] ?? "") : "";
		},
		[categories, displayFactor],
	);

	// ─── Filtered rows by selected categories (purchasing only) ────────
	const filteredPurchasingRows = useMemo(() => {
		if (selectedCategories.length === 0) return purchasingRows;
		return purchasingRows.filter((row) => {
			const cat = computeCategoryName(
				row as RequirementRow,
				categories,
				displayFactor,
			);
			return cat ? selectedCategories.includes(cat) : true;
		});
	}, [purchasingRows, selectedCategories, categories, displayFactor]);

	// ─── Filtered rows by selected categories (bundling only) ────────
	const filteredBundlingRows = useMemo(() => {
		if (selectedCategories.length === 0) return bundlingRows;
		return bundlingRows.filter((row) => {
			const cat = computeCategoryName(
				row as BundlingRow,
				categories,
				displayFactor,
			);
			return cat ? selectedCategories.includes(cat) : true;
		});
	}, [bundlingRows, selectedCategories, categories, displayFactor]);

	// Tracks the grid's column visibility model via onChange (uncontrolled).
	// Used by the show/hide demand toggle to preserve non-demand column settings.
	const [userColumnVisibilityModel, setUserColumnVisibilityModel] = useState<
		Record<string, boolean>
	>({});
	const userColumnVisibilityModelRef = useRef<Record<string, boolean>>({});

	// ─── Filter Panel ─────────────────────────────────────────────────
	const filterPanel = (
		<Paper sx={{ width: "100%", mb: 3, p: 3, borderRadius: 2 }}>
			<Box
				sx={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					mb: 2,
				}}
			>
				<Typography variant="h6" sx={{ fontWeight: 600 }}>
					{mode === "purchasing"
						? "Purchase Requirements Filters"
						: "Bundling Requirements Filters"}
				</Typography>
				<ToggleButtonGroup
					value={mode}
					exclusive
					onChange={(_, newMode) => {
						if (newMode !== null) {
							setMode(newMode);
							setApplied(false);
							setGridError(null);
							setPurchasingRows([]);
							setBundlingRows([]);
							setPurchasingColumns([]);
							setBundlingColumns([]);
						}
					}}
					size="small"
					color="primary"
				>
					<ToggleButton
						value="purchasing"
						sx={{ textTransform: "none", fontWeight: 600, px: 2 }}
					>
						Purchasing
					</ToggleButton>
					<ToggleButton
						value="bundling"
						sx={{ textTransform: "none", fontWeight: 600, px: 2 }}
					>
						Bundling
					</ToggleButton>
				</ToggleButtonGroup>
			</Box>

			<Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
				{/* Left column - filters (60%) */}
				<Box sx={{ flex: "3 1 0%", minWidth: 300 }}>
					<Grid container spacing={3}>
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
											sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
										/>
									)}
								/>
							</FormControl>
						</Grid>
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

					{frequency === "weekly" && monthlyKeys.length > 0 && (
						<Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mt: 2 }}>
							{monthlyKeys.map((mk) => (
								<TextField
									key={mk}
									size="small"
									type="number"
									label={dayjs(mk + "-01").format("MMM")}
									value={monthlyValidDays[mk]}
									onChange={(e) => {
										const v = parseInt(e.target.value, 10);
										if (!isNaN(v) && v > 0) {
											setMonthlyValidDays((prev) => ({ ...prev, [mk]: v }));
										}
									}}
									slotProps={{ htmlInput: { min: 1, max: 31 } }}
									sx={{
										width: 86,
										"& .MuiOutlinedInput-root": { borderRadius: 2 },
									}}
								/>
							))}
						</Box>
					)}
				</Box>

				<Divider
					orientation="vertical"
					flexItem
					sx={{ display: { xs: "none", md: "block" }, alignSelf: "stretch" }}
				/>

				{/* Right column - DateRange (40%) */}
				<Box sx={{ flex: "2 1 0%", minWidth: 250 }}>
					<Box sx={{ overflowY: "auto" }}>
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
											views={["month", "year"]}
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
											views={["month", "year"]}
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

	// ─── Excel Export ─────────────────────────────────────────────────
	const handleExcelExport = useCallback(async () => {
		if (mode === "purchasing") {
			// Use the grid's public API to get filtered/sorted row IDs.
			// getSortedRowIds() is part of the public GridSortApi interface and
			// returns all rows in display order (filter + sort applied), without
			// the virtualization problem that a DOM-based approach would have.
			const sortedRowIds = apiRef.current.getSortedRowIds();
			const rowById = new Map(
				filteredPurchasingRows.map((r) => [r.id, r]),
			);

			const rowsToExport: Record<string, unknown>[] = [];
			for (const id of sortedRowIds) {
				const row = rowById.get(id);
				if (row) {
					rowsToExport.push(row as Record<string, unknown>);
				}
			}

			// Fallback: if the grid returned nothing, export all category-filtered rows
			if (rowsToExport.length === 0) {
				rowsToExport.push(
					...filteredPurchasingRows.map(
						(r) => r as Record<string, unknown>,
					),
				);
			}

			await exportDataGridToExcel(
				rowsToExport,
				purchasingColumns,
				{
					title: "Stock Movement Report",
					subtitle: selectedPrincipal?.Descr ?? "",
					columnGroupingModel: purchasingColumnGroupModelRef.current,
					getRowFill: (row) => {
						const cat = computeCategoryName(
							row as unknown as RequirementRow,
							categories,
							displayFactor,
						);
						return cat ? (CAT_EXCEL_COLORS[cat] ?? null) : null;
					},
				},
				"purchase-requirements.xlsx",
			);
		} else {
			await exportDataGridToExcel(
				bundlingRows as unknown as Record<string, unknown>[],
				bundlingColumns,
				undefined,
				"bundling-requirements.xlsx",
			);
		}
	}, [
		mode,
		filteredPurchasingRows,
		bundlingRows,
		purchasingColumns,
		bundlingColumns,
		selectedPrincipal,
		categories,
		displayFactor,
		apiRef,
	]);

	// ─── Purchasing Toolbar ──────────────────────────────────────────
	const PurchasingToolbar = useCallback(() => {
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
						<ExportPrint
							size="small"
							startIcon={<PrintIcon />}
							sx={{
								minWidth: "auto",
								textTransform: "none",
								fontSize: "0.8125rem",
								fontWeight: 500,
								px: 0.75,
								color: "primary.main",
							}}
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
							slotProps={{ htmlInput: { step: 0.1, min: 0.1 } }}
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
						sx={{ width: 200, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
					/>
					<Button
						size="small"
						variant="outlined"
						startIcon={
							showDemandColumns ? <VisibilityOffIcon /> : <VisibilityIcon />
						}
						onClick={() => {
							const newShow = !showDemandColumns;
							setShowDemandColumns(newShow);
							// Programmatically toggle demand columns via apiRef,
							// preserving user's non-demand column settings from the panel.
							const model = {
								...userColumnVisibilityModelRef.current,
							};
							for (const col of purchasingColumns) {
								if (col.field.startsWith("pd_")) {
									if (!newShow) {
										model[col.field] = false;
									} else {
										delete model[col.field];
									}
								}
							}
							apiRef.current?.setColumnVisibilityModel(model);
						}}
						sx={{ textTransform: "none", borderRadius: 2, ml: "auto" }}
					>
						{showDemandColumns ? "Hide" : "Show"} {frequency === "monthly" ? "Monthly" : "Weekly"} Demand
					</Button>
				</Box>
			</Box>
		);
	}, [
		apiRef,
		handleExcelExport,
		theme,
		darkMode,
		frequency,
		bulkMinStock,
		handleBulkMinStockApply,
		priceClasses,
		selectedPriceClass,
		categoryOptions,
		selectedCategories,
		poReference,
		showDemandColumns,
		purchasingColumns,
		userColumnVisibilityModelRef,
	]);

	// ─── Bundling Toolbar ───────────────────────────────────────────
	const BundlingToolbar = useCallback(() => {
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
						Promo Products — Bundling Analysis
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
						<ExportPrint
							size="small"
							startIcon={<PrintIcon />}
							sx={{
								minWidth: "auto",
								textTransform: "none",
								fontSize: "0.8125rem",
								fontWeight: 500,
								px: 0.75,
								color: "primary.main",
							}}
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
				</Box>
			</Box>
		);
	}, [handleExcelExport, theme, darkMode, categoryOptions, selectedCategories]);

	// ─── Persist Form State ──────────────────────────────────────────
	const persistState = useMemo(
		() => ({
			mode,
			selectedPrincipal,
			selectedStorage,
			frequency,
			dateRanges: serializeDateRanges(dateRanges),
		}),
		[mode, selectedPrincipal, selectedStorage, frequency, dateRanges],
	);

	useEffect(() => {
		persistFormState(persistState);
	}, [persistState]);

	// Auto-scroll to results after DataGrid finishes rendering
	useEffect(() => {
		if (
			applied &&
			(purchasingColumns.length > 0 || bundlingColumns.length > 0)
		) {
			// Double rAF — wait for DataGrid virtual scroller layout to settle
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					resultsAnchorRef.current?.scrollIntoView({
						behavior: "smooth",
						block: "start",
					});
				});
			});
		}
	}, [applied, purchasingColumns.length, bundlingColumns.length]);

	// ─── Sync price column visibility with selectedPriceClass ────────
	useEffect(() => {
		if (!applied || mode !== "purchasing") return;

		const listPriceFields = [
			"listPrice_ao",
			"listPrice_perCS",
			"listPrice_perStkUnit",
		];
		const costPriceFields = [
			"costPrice_ao",
			"costPrice_perCS",
			"costPrice_perStkUnit",
		];

		const model = { ...userColumnVisibilityModelRef.current };
		if (selectedPriceClass == null) {
			// No class selected: show all price columns
			for (const f of [...listPriceFields, ...costPriceFields]) {
				delete model[f];
			}
		} else if (selectedPriceClass === "CP1") {
			// List Price: show list price, hide cost
			for (const f of listPriceFields) delete model[f];
			for (const f of costPriceFields) model[f] = false;
		} else {
			// Cost: show cost, hide list price
			for (const f of costPriceFields) delete model[f];
			for (const f of listPriceFields) model[f] = false;
		}

		// Guard: only set if apiRef is attached to a mounted grid
		const timer = setTimeout(() => {
			apiRef.current?.setColumnVisibilityModel(model);
		}, 0);
		return () => clearTimeout(timer);
	}, [selectedPriceClass, applied, mode, apiRef]);

	// ─── Column Grouping Models ──────────────────────────────────────
	const purchasingColumnGroupModel = useMemo<GridColumnGroupingModel>(
		() => {
			const groups: GridColumnGroupingModel = [
				{
					groupId: `${frequency === "monthly" ? "Monthly" : "Weekly"} Demand`,
					headerClassName: "group-demand",
					children: periodKeys.map((key) => ({
						field: `pd_${key.replace(/[\s]/g, "_")}`,
					})),
				},
				{
					groupId: `${frequency === "monthly" ? "Monthly" : "Weekly"} Computation`,
					headerClassName: "group-computation",
					children: [
						{ field: "totalDemand" },
						{ field: "totalDemandCS" },
						{ field: "avgDemand" },
						{ field: "avgDemandCS" },
						{ field: "stockCoverCount" },
					],
				},
				{
					groupId: "Order",
					headerClassName: "group-stock",
					children: [
						{ field: "coverageThreshold" },
						{ field: "suggestedOrder" },
						{ field: "suggestedOrderCS" },
						{ field: "customOrder" },
						{ field: "amount" },
					],
				},
				{
					groupId: "Inventory",
					headerClassName: "group-inventory",
					children: [
						{ field: "qtyAlloc" },
						{ field: "qtyOnPO" },
						{ field: "qtyOnHand" },
						{ field: "qtyAvail" },
					],
				},
			];

			// Conditionally include price column groups based on selectedPriceClass
			const isListPrice = selectedPriceClass === "CP1";
			if (selectedPriceClass == null) {
				// No class selected: show both price groups
				groups.push({
					groupId: "List Price (CP1)",
					headerClassName: "group-price",
					children: [
						{ field: "listPrice_ao" },
						{ field: "listPrice_perCS" },
						{ field: "listPrice_perStkUnit" },
					],
				});
				groups.push({
					groupId: "Price (Cost)",
					headerClassName: "group-price",
					children: [
						{ field: "costPrice_ao" },
						{ field: "costPrice_perCS" },
						{ field: "costPrice_perStkUnit" },
					],
				});
			} else if (isListPrice) {
				// List Price selected: show only List Price (CP1) group
				groups.push({
					groupId: "List Price (CP1)",
					headerClassName: "group-price",
					children: [
						{ field: "listPrice_ao" },
						{ field: "listPrice_perCS" },
						{ field: "listPrice_perStkUnit" },
					],
				});
			} else {
				// Cost Price selected: show only Price (Cost) group
				groups.push({
					groupId: "Price (Cost)",
					headerClassName: "group-price",
					children: [
						{ field: "costPrice_ao" },
						{ field: "costPrice_perCS" },
						{ field: "costPrice_perStkUnit" },
					],
				});
			}

			return groups;
		},
		[periodKeys, frequency, selectedPriceClass],
	);

	const purchasingColumnGroupModelRef = useRef(purchasingColumnGroupModel);
	useEffect(() => {
		purchasingColumnGroupModelRef.current = purchasingColumnGroupModel;
	}, [purchasingColumnGroupModel]);

	const bundlingColumnGroupModel = useMemo<GridColumnGroupingModel>(
		() => [
			{
				groupId: `${frequency === "monthly" ? "Monthly" : "Weekly"} Demand`,
				headerClassName: "group-demand",
				children: periodKeys.map((key) => ({
					field: `pd_${key.replace(/[\s]/g, "_")}`,
				})),
			},
			{
				groupId: `${frequency === "monthly" ? "Monthly" : "Weekly"} Computation`,
				headerClassName: "group-computation",
				children: [
					{ field: "avgDemand" },
					{ field: "stockCoverCount" },
				],
			},
			{
				groupId: "Inventory",
				headerClassName: "group-inventory",
				children: [
					{ field: "qtyAlloc" },
					{ field: "qtyOnPO" },
					{ field: "qtyOnHand" },
					{ field: "qtyAvail" },
				],
			},
		],
		[periodKeys, frequency],
	);

	// ─── Render ───────────────────────────────────────────────────────
	return (
		<>
			{filterPanel}

			{applied && mode === "purchasing" && purchasingColumns.length > 0 && (
				<Paper
					sx={{
						width: "100%",
						borderRadius: 2,
						overflow: "hidden",
						height: "calc(100dvh - 100px)",
					}}
				>
					<DataGrid
						apiRef={apiRef}
						rows={filteredPurchasingRows}
						columns={purchasingColumns}
						columnGroupingModel={purchasingColumnGroupModel}
						columnGroupHeaderHeight={36}
						onColumnVisibilityModelChange={(model) => {
							setUserColumnVisibilityModel(model);
							userColumnVisibilityModelRef.current = model;
						}}
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
						slots={{ toolbar: PurchasingToolbar as React.ComponentType<any> }} // eslint-disable-line @typescript-eslint/no-explicit-any
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
							} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
							pagination: { labelRowsPerPage: "Rows:" },
						}}
						initialState={{
							pagination: { paginationModel: { pageSize: 20 } },
							sorting: { sortModel: [{ field: "_category", sort: "asc" }] },
						}}
						pageSizeOptions={[10, 20, 50]}
						checkboxSelection
						disableRowSelectionOnClick
						sx={{
							height: "100%",
							"& .MuiDataGrid-columnHeader": {
								fontWeight: 600,
								fontSize: "0.8rem",
							},
							"& .MuiDataGrid-columnHeaders": {
								borderBottom: 2,
								borderColor: "divider",
							},
							"& .MuiDataGrid-columnHeader--filledGroup .MuiDataGrid-columnHeaderTitleContainer": {
								justifyContent: "center",
							},
							"& .MuiDataGrid-columnHeader--filledGroup .MuiDataGrid-columnHeaderTitle": {
								textAlign: "center",
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
							"& .group-price": {
								backgroundColor: groupColors.price.bg,
								color: groupColors.price.color,
							},
							"& .group-stock": {
								backgroundColor: groupColors.stock.bg,
								color: groupColors.stock.color,
							},
							"& .group-inventory": {
								backgroundColor: groupColors.inventory.bg,
								color: groupColors.inventory.color,
							},
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
							"& .MuiDataGrid-cell:focus": { outline: "none" },
							"& .MuiDataGrid-cell:focus-within": { outline: "none" },
							"& .MuiDataGrid-footerContainer": {
								borderTop: "1px solid",
								borderColor: "divider",
							},
							"& .MuiDataGrid-virtualScroller": { minHeight: 300 },
						}}
					/>
				</Paper>
			)}

			{applied && mode === "bundling" && bundlingColumns.length > 0 && (
				<Paper
					sx={{
						width: "100%",
						borderRadius: 2,
						overflow: "hidden",
						height: "calc(100dvh - 100px)",
					}}
				>
					<DataGrid
						rows={filteredBundlingRows}
						columns={bundlingColumns}
						columnGroupingModel={bundlingColumnGroupModel}
						columnGroupHeaderHeight={36}
						getRowClassName={getRowClassName}
						getRowHeight={() => 42}
						showToolbar
						slots={{ toolbar: BundlingToolbar as React.ComponentType<any> }} // eslint-disable-line @typescript-eslint/no-explicit-any
						slotProps={{
							toolbar: {
								handleExcelExport,
								categoryOptions,
								selectedCategories,
								setSelectedCategories,
								darkMode,
							} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
							pagination: { labelRowsPerPage: "Rows:" },
						}}
						initialState={{
							pagination: { paginationModel: { pageSize: 20 } },
							sorting: { sortModel: [{ field: "_category", sort: "asc" }] },
						}}
						pageSizeOptions={[10, 20, 50]}
						checkboxSelection
						disableRowSelectionOnClick
						sx={{
							height: "100%",
							"& .MuiDataGrid-columnHeader": {
								fontWeight: 600,
								fontSize: "0.8rem",
							},
							"& .MuiDataGrid-columnHeaders": {
								borderBottom: 2,
								borderColor: "divider",
							},
							"& .MuiDataGrid-columnHeader--filledGroup .MuiDataGrid-columnHeaderTitleContainer": {
								justifyContent: "center",
							},
							"& .MuiDataGrid-columnHeader--filledGroup .MuiDataGrid-columnHeaderTitle": {
								textAlign: "center",
							},
							"& .group-demand": {
								backgroundColor: groupColors.demand.bg,
								color: groupColors.demand.color,
							},
							"& .group-computation": {
								backgroundColor: groupColors.computation.bg,
								color: groupColors.computation.color,
							},
							"& .group-bundling": {
								backgroundColor: groupColors.bundling.bg,
								color: groupColors.bundling.color,
							},
							"& .group-component": {
								backgroundColor: groupColors.component.bg,
								color: groupColors.component.color,
							},
							"& .group-inventory": {
								backgroundColor: groupColors.inventory.bg,
								color: groupColors.inventory.color,
							},
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
							"& .MuiDataGrid-cell:focus": { outline: "none" },
							"& .MuiDataGrid-cell:focus-within": { outline: "none" },
							"& .MuiDataGrid-footerContainer": {
								borderTop: "1px solid",
								borderColor: "divider",
							},
							"& .MuiDataGrid-virtualScroller": { minHeight: 300 },
						}}
					/>
				</Paper>
			)}

			{/* Scroll anchor for auto-scroll on apply */}
			<div ref={resultsAnchorRef} />
		</>
	);
};

export default RequirementsPage;
