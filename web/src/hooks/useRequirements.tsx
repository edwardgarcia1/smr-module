import {
	useState,
	useCallback,
	useMemo,
	useEffect,
	useRef,
} from "react";
import { Chip } from "@mui/material";
import {
	useGridApiRef,
} from "@mui/x-data-grid";
import type {
	GridColDef,
	GridRowModel,
	GridColumnGroupingModel,
} from "@mui/x-data-grid";
import dayjs from "dayjs";
import { useThemeMode } from "../providers/AppProvider";
import {
	formatDate,
	fmt2,
	fmtFixed2,
	fmt0,
} from "../utils/numberFormat";
import { exportDataGridToExcel } from "../utils/exportToExcel";
import type { LogoOption } from "../components/requirements/PoPdfExportDialog";

// ─── Logo options (discovered at build time via Vite import.meta.glob) ──────
const logoModules = import.meta.glob<{ default: string }>("../assets/logo/*.{jpg,jpeg,png}", {
	eager: true,
});
export const LOGO_OPTIONS: LogoOption[] = Object.entries(logoModules)
	.map(([path, mod]) => ({
		name: path.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") ?? path,
		src: mod.default,
	}))
	.sort((a, b) => a.name.localeCompare(b.name));
import apiRequest from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import type { ConflictingPo } from "../components/requirements/ExistingPoWarningDialog";
import ComponentsListCell from "../components/requirements/ComponentsListCell";
import {
	computeCategoryName,
	buildGroupColors,
	periodSortValue,
	loadPersistedForm,
	persistFormState,
	serializeDateRange,
	ALLOWED_SITE_IDS,
	CATEGORY_CLASS_MAP,
	CATEGORY_ORDER,
	CAT_EXCEL_COLORS,
	type Mode,
	type Frequency,
	type DemandMode,
	type Principal,
	type StorageLocation,
	type MinStockCategory,
	type RequirementRow,
	type BundlingRow,
	type DateRangeItem,
	type GroupColors,
} from "../config/requirements";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface UseRequirementsReturn {
	mode: Mode;
	setMode: (m: Mode) => void;
	darkMode: boolean;
	groupColors: GroupColors;
	principals: Principal[];
	selectedPrincipal: Principal | null;
	setSelectedPrincipal: (p: Principal | null) => void;
	storageLocations: StorageLocation[];
	selectedStorage: StorageLocation[];
	setSelectedStorage: (l: StorageLocation[]) => void;
	frequency: Frequency;
	setFrequency: (f: Frequency) => void;
	demandMode: DemandMode;
	setDemandMode: (m: DemandMode) => void;
	dateRange: DateRangeItem;
	setDateRange: React.Dispatch<React.SetStateAction<DateRangeItem>>;
	monthlyValidDays: Record<string, number>;
	monthlyKeys: string[];
	handleMonthlyValidDayChange: (monthKey: string, value: number) => void;
	applied: boolean;
	isApplying: boolean;
	gridError: string | null;
	setGridError: (msg: string | null) => void;
	purchasingRows: GridRowModel[];
	bundlingRows: GridRowModel[];
	purchasingColumns: GridColDef[];
	bundlingColumns: GridColDef[];
	filteredPurchasingRows: GridRowModel[];
	filteredBundlingRows: GridRowModel[];
	handleApply: () => void;
	handleBulkMinStockApply: () => void;
	processRowUpdate: (newRow: GridRowModel, oldRow: GridRowModel) => Promise<GridRowModel>;
	getRowClassName: (params: { row: GridRowModel }) => string;
	handleExcelExport: () => void;
	bulkMinStock: string;
	setBulkMinStock: (v: string) => void;
	selectedPriceClass: string;
	setSelectedPriceClass: (v: string) => void;
	savePoDialogOpen: boolean;
	openSavePoDialog: () => void;
	closeSavePoDialog: () => void;
	isSavingPo: boolean;
	handleSavePurchaseOrder: (refNum: string) => Promise<void>;
	showDemandColumns: boolean;
	setShowDemandColumns: (v: boolean) => void;
	priceClasses: string[];
	categories: MinStockCategory[];
	selectedCategories: string[];
	setSelectedCategories: (v: string[]) => void;
	apiRef: ReturnType<typeof useGridApiRef>;
	resultsAnchorRef: React.RefObject<HTMLDivElement | null>;
	userColumnVisibilityModelRef: React.MutableRefObject<Record<string, boolean>>;
	purchasingColumnGroupModel: GridColumnGroupingModel;
	bundlingColumnGroupModel: GridColumnGroupingModel;
	periodKeys: string[];
	displayFactor: number;
	existingPoWarningOpen: boolean;
	existingPoWarning: ConflictingPo[];
	handleContinueApply: () => void;
	closeExistingPoWarning: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRequirements(): UseRequirementsReturn {
	const { darkMode } = useThemeMode();

	// ─── Load persisted form ──────────────────────────────────────────
	const persistedForm = useMemo(() => loadPersistedForm(), []);

	// ─── Mode toggle ──────────────────────────────────────────────────
	const [mode, setModeState] = useState<Mode>(persistedForm?.mode ?? "purchasing");

	// ─── Theme-aware group colors ─────────────────────────────────────
	const groupColors = useMemo(() => buildGroupColors(darkMode), [darkMode]);

	// ─── Filter state ─────────────────────────────────────────────────
	const [selectedPrincipal, setSelectedPrincipal] = useState<Principal | null>(
		persistedForm?.selectedPrincipal ?? null,
	);
	const [principals, setPrincipals] = useState<Principal[]>([]);

	const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
	const [selectedStorage, setSelectedStorage] = useState<StorageLocation[]>(
		persistedForm?.selectedStorage ?? [],
	);

	const [dateRange, setDateRange] = useState<DateRangeItem>(() => {
		const saved = persistedForm?.dateRange;
		if (saved && saved.from && saved.to) {
			return {
				from: saved.from ? dayjs(saved.from) : null,
				to: saved.to ? dayjs(saved.to) : null,
			};
		}
		return { from: null, to: null };
	});

	const [frequency, setFrequency] = useState<Frequency>(
		persistedForm?.frequency ?? "monthly",
	);
	const [demandMode, setDemandMode] = useState<DemandMode>(
		persistedForm?.demandMode ?? "average",
	);
	const [monthlyValidDays, setMonthlyValidDays] = useState<Record<string, number>>({});
	const monthlyKeys = useMemo(
		() => Object.keys(monthlyValidDays).sort(),
		[monthlyValidDays],
	);

	const handleMonthlyValidDayChange = useCallback((monthKey: string, value: number) => {
		setMonthlyValidDays((prev) => ({ ...prev, [monthKey]: value }));
	}, []);

	// ─── Fetch all reference data via /lookups ────────────────────────
	const [priceClasses, setPriceClasses] = useState<string[]>([]);
	const [categories, setCategories] = useState<MinStockCategory[]>([]);

	useEffect(() => {
		let cancelled = false;
		const fetchOptions = async () => {
			try {
				const data = await apiRequest<{
					sites: { SiteId: string; Name: string }[];
					principals: Principal[];
					priceClasses: string[];
					minStockCategories: MinStockCategory[];
				}>("/lookups");
				if (!cancelled && data) {
					setStorageLocations(
						data.sites
							.filter((s) => ALLOWED_SITE_IDS.has(s.SiteId))
							.map((s) => ({ id: s.SiteId, name: s.Name })),
					);
					setPrincipals(data.principals);
					setPriceClasses(data.priceClasses ?? []);
					setCategories(data.minStockCategories ?? []);
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

	// ─── Grid state ───────────────────────────────────────────────────
	const [purchasingRows, setPurchasingRows] = useState<GridRowModel[]>([]);
	const [bundlingRows, setBundlingRows] = useState<GridRowModel[]>([]);
	const [purchasingColumns, setPurchasingColumns] = useState<GridColDef[]>([]);
	const [bundlingColumns, setBundlingColumns] = useState<GridColDef[]>([]);
	const [gridError, setGridError] = useState<string | null>(null);
	const [applied, setApplied] = useState(false);
	const [isApplying, setIsApplying] = useState(false);
	const [savePoDialogOpen, setSavePoDialogOpen] = useState(false);
	const [isSavingPo, setIsSavingPo] = useState(false);
	const openSavePoDialog = useCallback(() => setSavePoDialogOpen(true), []);
	const closeSavePoDialog = useCallback(() => setSavePoDialogOpen(false), []);
	const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

	// ─── Existing PO warning dialog state ──────────────────────────
	const [existingPoWarningOpen, setExistingPoWarningOpen] = useState(false);
	const [existingPoWarning, setExistingPoWarning] = useState<ConflictingPo[]>([]);
	const closeExistingPoWarning = useCallback(() => {
		setExistingPoWarningOpen(false);
	}, []);

	const setMode = useCallback((newMode: Mode) => {
		setModeState(newMode);
		setApplied(false);
		setGridError(null);
		setPurchasingRows([]);
		setBundlingRows([]);
		setPurchasingColumns([]);
		setBundlingColumns([]);
	}, []);

	// ─── Compute per-month valid days from date range (weekly only) ──
	useEffect(() => {
		if (frequency !== "weekly") {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setMonthlyValidDays({});
			return;
		}
		const dr = dateRange;
		if (!dr.from || !dr.to) return;
		const monthSet = new Set<string>();
		let current = dr.from.startOf("month");
		while (current.isBefore(dr.to) || current.isSame(dr.to, "month")) {
			monthSet.add(current.format("YYYY-MM"));
			current = current.add(1, "month");
		}
		const sortedMonths = Array.from(monthSet).sort();
		setMonthlyValidDays((prev) => {
			const next: Record<string, number> = {};
			for (const m of sortedMonths) {
				if (prev[m] != null) {
					next[m] = prev[m];
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
	}, [frequency, dateRange]);

	// ─── Toolbar states ───────────────────────────────────────────────
	const [bulkMinStock, setBulkMinStock] = useState<string>("1.0");
	const [selectedPriceClass, setSelectedPriceClass] = useState<string>("COST");
	const [showDemandColumns, setShowDemandColumns] = useState(true);

	// ─── Refs ─────────────────────────────────────────────────────────
	const apiRef = useGridApiRef();
	const periodKeysRef = useRef<string[]>([]);
	const [periodKeys, setPeriodKeys] = useState<string[]>([]);
	const [displayFactor, setDisplayFactor] = useState(1.0);
	const displayFactorRef = useRef(1.0);
	const categoriesRef = useRef(categories);
	const resultsAnchorRef = useRef<HTMLDivElement>(null);
	const userColumnVisibilityModelRef = useRef<Record<string, boolean>>({});

	useEffect(() => {
		categoriesRef.current = categories;
	}, [categories]);

	// ─── Build Purchasing Columns ──────────────────────────────────────
	const buildPurchasingColumns = useCallback(
		(periodKeys: string[], df: number): GridColDef[] => {
			const demandLabel = demandMode === "highest"
				? "Highest Demand"
				: `Avg ${frequency === "monthly" ? "Monthly" : "Weekly"}`;
			const demandLabelCS = demandMode === "highest"
				? "Highest Demand (CS)"
				: `Avg ${frequency === "monthly" ? "Monthly" : "Weekly"} (CS)`;

			const cols: GridColDef[] = [];
			const staticHeader = { headerClassName: "group-static" };
			const priceHeader = { headerClassName: "group-price" };

			cols.push({ field: "invtID", headerName: "Inventory ID", width: 110, ...staticHeader });
			cols.push({ field: "descr", headerName: "Description", width: 260, ...staticHeader });
			cols.push({ field: "stkUnit", headerName: "Stock Unit", width: 90, ...staticHeader });
			cols.push({
				field: "qtyPerCS", headerName: "Qty/CS", width: 90, type: "number", ...staticHeader,
				description: "Conversion factor from Stock Unit to CS (CnvFact from INUnit)",
				valueFormatter: (value?: number) => (value != null ? value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : "—"),
			});

			// Price columns
			cols.push({ field: "price_ao", headerName: "Last Update", width: 150, ...priceHeader,
				valueGetter: (_v, row) => (row as RequirementRow).price_ao,
				valueFormatter: (value?: string) => formatDate(value),
			});
			cols.push({ field: "price_perCS", headerName: "Per CS", width: 110, type: "number", ...priceHeader,
				valueGetter: (_v, row) => (row as RequirementRow).price_perCS,
				valueFormatter: fmt2,
			});
			cols.push({ field: "price_perStkUnit", headerName: "Per StkUnit", width: 110, type: "number", ...priceHeader,
				valueGetter: (_v, row) => (row as RequirementRow).price_perStkUnit,
				valueFormatter: fmt2,
			});

			// Inventory columns
			const inventoryHeader = { headerClassName: "group-inventory" };
			for (const { field, label } of [
				{ field: "qtyAlloc", label: "Unreleased" },
				{ field: "qtyOnPO", label: "Incoming" },
				{ field: "qtyOnHand", label: "On Hand" },
				{ field: "qtyAvail", label: "Available" },
			]) {
				cols.push({ field, headerName: label, width: 110, type: "number", ...inventoryHeader, valueFormatter: fmt2 });
			}

			// Demand columns
			periodKeys.forEach((key) => {
				const fieldKey = `pd_${key.replace(/[\s]/g, "_")}`;
				cols.push({
					field: fieldKey, headerName: key, width: 110, type: "number",
					headerClassName: "group-demand",
					valueGetter: (_v, row) => (row as RequirementRow).periodDemand[key] ?? 0,
					valueFormatter: fmt2,
				});
			});

			// Computation columns
			const compHeader = { headerClassName: "group-computation" };
			cols.push({
				field: "totalDemand", headerName: "Total", width: 110, type: "number", ...compHeader,
				valueGetter: (_v, row) => Object.values((row as RequirementRow).periodDemand ?? {}).reduce((s, v) => s + v, 0),
				valueFormatter: fmt2,
			});
			cols.push({ field: "totalDemandCS", headerName: "Total (CS)", width: 110, type: "number", ...compHeader,
				valueGetter: (_v, row) => (row as RequirementRow).totalDemandCS,
				valueFormatter: fmt2,
			});
			cols.push({
				field: "avgDemand", headerName: demandLabel,
				width: 150, type: "number", ...compHeader, valueFormatter: fmt2,
			});
			cols.push({
				field: "avgDemandCS", headerName: demandLabelCS,
				width: 120, type: "number", ...compHeader,
				description: `${demandMode === "highest" ? "Highest period" : "Average"} demand converted to cases (CS)`, valueFormatter: fmt2,
			});
			cols.push({
				field: "stockCoverCount", headerName: `Stock Cover (${frequency === "monthly" ? "Months" : "Weeks"})`,
				width: 130, type: "number", ...compHeader, valueFormatter: fmtFixed2,
			});

			// Stock / Order columns
			const stockHeader = { headerClassName: "group-stock" };
			cols.push({
				field: "coverageThreshold", headerName: `Min Stock (${frequency === "weekly" ? "Weeks" : "Months"})`,
				width: 100, type: "number", editable: true, ...stockHeader,
				renderEditCell: (params) => {
					const editDisplayValue =
						frequency === "weekly" && params.value != null
							? (Number(params.value) * df).toFixed(2)
							: (params.value ?? "");
					return (
						<input
							type="number" step={0.1} value={editDisplayValue}
							onChange={(e) => {
								const rawVal = parseFloat(e.target.value);
								if (!isNaN(rawVal)) {
									const monthsVal = frequency === "weekly" ? rawVal / df : rawVal;
									params.api.setEditCellValue({
										id: params.id, field: params.field, value: monthsVal,
									});
								}
							}}
							style={{ width: "100%", height: "100%", border: "none", outline: "none", textAlign: "center", padding: "0 8px", fontFamily: "inherit", fontSize: "inherit", color: "inherit", background: "transparent" }}
							autoFocus
						/>
					);
				},
				valueFormatter: (value?: number) => {
					if (value == null) return "";
					return frequency === "weekly" ? (value * df).toFixed(2) : value.toFixed(2);
				},
			});
			cols.push({ field: "suggestedOrder", headerName: "Suggested Order", width: 180, type: "number", ...stockHeader,
				description: "Stock-aware: fills up to the resolved min stock threshold (per-item coverage)",
				valueFormatter: fmt2,
			});
			cols.push({ field: "suggestedOrderCS", headerName: "Suggested Order (CS)", width: 130, type: "number", ...stockHeader,
				description: "Suggested order converted to cases (CS)", valueFormatter: fmt2,
			});
			cols.push({ field: "customOrder", headerName: "Custom Order (CS)", width: 130, type: "number", editable: true, ...stockHeader,
				valueFormatter: fmt2,
			});

			// Final Order
			const finalOrderHeader = { headerClassName: "group-final-order" };
			cols.push({
				field: "finalOrderCS", headerName: "Final Order (CS)", width: 130, type: "number", ...finalOrderHeader,
				description: "Actual order: Custom Order (CS) when set, otherwise Suggested Order (CS)",
				valueGetter: (_v, row: RequirementRow) => row.customOrder != null ? row.customOrder : row.suggestedOrderCS,
				valueFormatter: fmt2,
			});

			const periodLabel = frequency === "monthly" ? "Months" : "Weeks";
			const getFinalQty = (row: RequirementRow) => row.customOrder != null ? row.customOrder : row.suggestedOrderCS;

			cols.push({
				field: "orderCover", headerName: `Order Cover (${periodLabel})`, width: 130, type: "number", ...stockHeader,
				description: "Final Order (CS) ÷ Avg demand (CS)",
				valueGetter: (_v, row: RequirementRow) => {
					const finalQty = getFinalQty(row);
					if (row.avgDemandCS == null || row.avgDemandCS === 0 || finalQty == null) return null;
					return finalQty / row.avgDemandCS;
				},
				valueFormatter: fmtFixed2,
			});
			cols.push({
				field: "incomingCover", headerName: `Incoming Cover (${periodLabel})`, width: 130, type: "number", ...stockHeader,
				description: "Incoming (PO) ÷ Avg demand",
				valueGetter: (_v, row: RequirementRow) => {
					if (row.avgDemand == null || row.avgDemand === 0 || row.qtyOnPO == null) return null;
					return row.qtyOnPO / row.avgDemand;
				},
				valueFormatter: fmtFixed2,
			});
			cols.push({
				field: "totalCover", headerName: `Total Cover (${periodLabel})`, width: 140, type: "number", ...stockHeader,
				description: "Stock Cover + Order Cover + Incoming Cover",
				valueGetter: (_v, row: RequirementRow) => {
					const finalQty = getFinalQty(row);
					if (row.avgDemandCS == null || row.avgDemandCS === 0 || finalQty == null) return null;
					const orderCover = finalQty / row.avgDemandCS;
					const incomingCover = (row.qtyOnPO != null && row.avgDemand != null && row.avgDemand > 0) ? row.qtyOnPO / row.avgDemand : 0;
					return (row.stockCoverCount ?? 0) + orderCover + incomingCover;
				},
				valueFormatter: fmtFixed2,
			});
			cols.push({
				field: "amount", headerName: "Amount", width: 130, type: "number", ...stockHeader,
				description: "Order amount: customOrder × Price per CS, or suggestedOrderCS × Price per CS",
				valueGetter: (_v, row: RequirementRow) => {
					const qty = row.customOrder != null ? row.customOrder : row.suggestedOrderCS;
					const price = row.price_perCS;
					if (price == null) return null;
					return Math.round(qty * price * 100) / 100;
				},
				valueFormatter: fmt2,
			});
			cols.push({
				field: "_category", headerName: "Category", width: 130,
				valueGetter: (_v, row: RequirementRow) => computeCategoryName(row, categoriesRef.current, displayFactorRef.current),
				sortComparator: (v1: string | null, v2: string | null) => {
					const o1 = v1 ? (CATEGORY_ORDER[v1] ?? 99) : 99;
					const o2 = v2 ? (CATEGORY_ORDER[v2] ?? 99) : 99;
					return o1 - o2;
				},
			});
			return cols;
		},
		[frequency, demandMode],
	);

	// ─── Build Bundling Columns ────────────────────────────────────────
	const buildBundlingColumns = useCallback(
		(periodKeys: string[], df: number): GridColDef[] => {
			const bundlingDemandLabel = demandMode === "highest"
				? "Highest Demand"
				: `Avg ${frequency === "monthly" ? "Monthly" : "Weekly"} Demand`;

			const cols: GridColDef[] = [];
			const staticHeader = { headerClassName: "group-static" };

			cols.push({ field: "invtID", headerName: "Promo ID", width: 120, ...staticHeader });
			cols.push({ field: "descr", headerName: "Description", width: 260, ...staticHeader });
			cols.push({ field: "stkUnit", headerName: "Stock Unit", width: 90, ...staticHeader });

			// Bundling status badge
			const bundlingHeader = { headerClassName: "group-bundling" };
			cols.push({
				field: "canFulfillFromBundling", headerName: "Bundle?", width: 90, ...bundlingHeader,
				renderCell: (params) => {
					const row = params.row as BundlingRow;
					return row.canFulfillFromBundling
						? <Chip size="small" label="Yes" color="success" variant="outlined" sx={{ fontWeight: 600, fontSize: "0.7rem" }} />
						: <Chip size="small" label="No" color="warning" variant="outlined" sx={{ fontWeight: 600, fontSize: "0.7rem" }} />;
				},
			});
			cols.push({ field: "bundlableQuantity", headerName: "Bundlable Qty", width: 120, type: "number", ...bundlingHeader, valueFormatter: fmt0 });
			cols.push({ field: "suggestedBundles", headerName: "Suggested Bundles", width: 130, type: "number", ...bundlingHeader, valueFormatter: fmt0 });

			// Components column
			cols.push({
				field: "components", headerName: "Components (avail / per bundle)", width: 700, minWidth: 500, flex: 1,
				headerClassName: "group-component", sortable: false, filterable: false,
				renderCell: (params) => {
					const row = params.row as BundlingRow;
					return <ComponentsListCell components={row.components ?? []} />;
				},
			});

			// Inventory columns
			const inventoryHeader = { headerClassName: "group-inventory" };
			for (const { field, label } of [
				{ field: "qtyAlloc", label: "Unreleased" },
				{ field: "qtyOnPO", label: "Incoming" },
				{ field: "qtyOnHand", label: "On Hand" },
				{ field: "qtyAvail", label: "Available" },
			]) {
				cols.push({ field, headerName: label, width: 110, type: "number", ...inventoryHeader, valueFormatter: fmt2 });
			}

			// Demand columns
			periodKeys.forEach((key) => {
				const fieldKey = `pd_${key.replace(/[\s]/g, "_")}`;
				cols.push({
					field: fieldKey, headerName: key, width: 110, type: "number",
					headerClassName: "group-demand",
					valueGetter: (_v, row) => (row as BundlingRow).periodDemand[key] ?? 0,
					valueFormatter: fmt2,
				});
			});

			// Computation columns
			const compHeader = { headerClassName: "group-computation" };
			cols.push({
				field: "avgDemand", headerName: bundlingDemandLabel,
				width: 150, type: "number", ...compHeader, valueFormatter: fmt2,
			});
			cols.push({
				field: "stockCoverCount", headerName: `Stock Cover (${frequency === "monthly" ? "Months" : "Weeks"})`,
				width: 130, type: "number", ...compHeader, valueFormatter: fmtFixed2,
			});

			// Category
			cols.push({
				field: "_category", headerName: "Category", width: 130,
				valueGetter: (_v, row: BundlingRow) => computeCategoryName(row, categoriesRef.current, df),
				sortComparator: (v1: string | null, v2: string | null) => {
					const o1 = v1 ? (CATEGORY_ORDER[v1] ?? 99) : 99;
					const o2 = v2 ? (CATEGORY_ORDER[v2] ?? 99) : 99;
					return o1 - o2;
				},
			});
			return cols;
		},
		[frequency, demandMode],
	);

	// ─── Core Apply Logic (fetches requirements data) ────────────────
	const executeApply = useCallback(async () => {
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
		if (!dateRange.from || !dateRange.to) {
			setGridError("Please select a date range.");
			setIsApplying(false);
			return;
		}
		if (dateRange.to.isBefore(dateRange.from)) {
			setGridError("End date must be after start date.");
			setIsApplying(false);
			return;
		}

		try {
			const params = new URLSearchParams();
			params.set("classID", selectedPrincipal.ClassID);
			params.set("frequency", frequency);
			params.set("priceClass", selectedPriceClass);
			if (demandMode === "highest") {
				params.set("demandMode", "highest");
			}
			if (frequency === "weekly") {
				const totalVD = Object.values(monthlyValidDays).reduce((s, v) => s + v, 0);
				if (totalVD > 0) {
					params.set("validDays", String(totalVD));
					params.set("monthlyValidDays", JSON.stringify(monthlyValidDays));
				}
			}

			params.set("dateRange", `${dateRange.from.startOf("month").format("YYYY-MM-DD")},${dateRange.to.endOf("month").format("YYYY-MM-DD")}`);
			for (const s of selectedStorage) {
				params.append("siteID", s.id);
			}

			const endpoint = mode === "purchasing" ? "/purchasing/requirements" : "/bundling/requirements";
			const data = await apiRequest<RequirementRow[] | BundlingRow[]>(`${endpoint}?${params.toString()}`);

			if (!data || data.length === 0) {
				setGridError(mode === "purchasing"
					? "No data matches the selected filters. Try adjusting your criteria."
					: "No promo items match the selected filters. Try adjusting your criteria.");
				setIsApplying(false);
				return;
			}

			const keys = Object.keys(data[0].periodDemand ?? {}).sort(
				(a, b) => periodSortValue(a) - periodSortValue(b),
			);
			periodKeysRef.current = keys;
			setPeriodKeys(keys);

			const totalVD = Object.values(monthlyValidDays).reduce((s, v) => s + v, 0);
			const df = frequency !== "weekly" || keys.length === 0 || totalVD === 0
				? 1.0
				: (() => {
						const uniqueMonths = new Set(keys.map((k) => {
							const m = k.match(/W\d+\s+(.+)/);
							return m ? m[1] : k;
						}));
						const nMonths = uniqueMonths.size;
						return nMonths > 0 ? (totalVD / 6) / nMonths : 1.0;
					})();
			setDisplayFactor(df);
			displayFactorRef.current = df;

			const gridRows = data.map((item, idx) => ({ ...item, id: idx + 1 }));

			if (mode === "purchasing") {
				const dynamicCols = buildPurchasingColumns(keys, df);
				setPurchasingColumns(dynamicCols);
				setPurchasingRows(gridRows);
			} else {
				const dynamicCols = buildBundlingColumns(keys, df);
				setBundlingColumns(dynamicCols);
				setBundlingRows(gridRows);
			}
			setApplied(true);
		} catch (err: unknown) {
			setGridError(err instanceof Error ? err.message : "Failed to fetch requirements data.");
		} finally {
			setIsApplying(false);
		}
	}, [
		selectedPrincipal, selectedStorage, dateRange, frequency,
		demandMode, monthlyValidDays, mode, selectedPriceClass,
		buildPurchasingColumns, buildBundlingColumns,
	]);

	// ─── Handle Apply (with PO conflict check) ─────────────────────
	const handleContinueApply = useCallback(async () => {
		setExistingPoWarningOpen(false);
		setExistingPoWarning([]);
		await executeApply();
	}, [executeApply]);

	const handleApply = useCallback(async () => {
		setGridError(null);
		setApplied(false);
		setPurchasingRows([]);
		setBundlingRows([]);
		setPurchasingColumns([]);
		setBundlingColumns([]);

		// Validation (no loading spinner during validation)
		if (!selectedPrincipal) {
			setGridError("Please select a Principal.");
			return;
		}
		if (!dateRange.from || !dateRange.to) {
			setGridError("Please select a date range.");
			return;
		}
		if (dateRange.to.isBefore(dateRange.from)) {
			setGridError("End date must be after start date.");
			return;
		}

		// Check for conflicting POs in purchasing mode before applying
		if (mode === "purchasing" && selectedPrincipal) {
			try {
				const conflicting = await apiRequest<ConflictingPo[]>(
					`/purchase-order/check/${encodeURIComponent(selectedPrincipal.ClassID)}`,
				);
				if (conflicting && conflicting.length > 0) {
					setExistingPoWarning(conflicting);
					setExistingPoWarningOpen(true);
					return; // Show warning — user must decide
				}
			} catch {
				// Non-blocking: if the check fails, just proceed
			}
		}

		await executeApply();
	}, [
		selectedPrincipal, selectedStorage, dateRange, frequency,
		demandMode, monthlyValidDays, mode, selectedPriceClass,
		buildPurchasingColumns, buildBundlingColumns, executeApply,
	]);

	// ─── Bulk min stock update ────────────────────────────────────────
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
				const existing = await apiRequest<{ id: number }>(`/min-stock/principals/class/${selectedPrincipal.ClassID}`);
				principalId = existing.id;
			} catch { /* create new */ }

			if (principalId) {
				await apiRequest(`/min-stock/principals/${principalId}`, { method: "PUT", body: { min_stock: val } });
			} else {
				await apiRequest("/min-stock/principals", { method: "POST", body: { class_id: selectedPrincipal.ClassID, min_stock: val } });
			}

			await executeApply();
		} catch (err: unknown) {
			setGridError(err instanceof Error ? err.message : "Failed to update principal min stock.");
		} finally {
			setIsApplying(false);
		}
	}, [bulkMinStock, selectedPrincipal, frequency, executeApply]);

	// ─── Grid Edit Handler (purchasing only) ──────────────────────────
	const processRowUpdate = useCallback(
		async (newRow: GridRowModel, oldRow: GridRowModel) => {
			const updatedRow = { ...newRow };

			if (newRow.coverageThreshold !== oldRow.coverageThreshold) {
				await apiRequest(`/min-stock/settings/${newRow.invtID}`, { method: "PATCH", body: { min_stock_setting: "Custom" } });

				let itemId: number | null = null;
				try {
					const existing = await apiRequest<{ id: number }>(`/min-stock/items/invt/${newRow.invtID}`);
					itemId = existing.id;
				} catch { /* create new */ }

				if (itemId) {
					await apiRequest(`/min-stock/items/${itemId}`, { method: "PUT", body: { min_stock: newRow.coverageThreshold } });
				} else {
					await apiRequest("/min-stock/items", { method: "POST", body: { inventory_id: newRow.invtID, min_stock: newRow.coverageThreshold } });
				}

				const effectiveThreshold = newRow.coverageThreshold * displayFactorRef.current;
				const targetStock = effectiveThreshold * newRow.avgDemand;
				updatedRow.suggestedOrder = Math.max(0, Math.round((targetStock - newRow.qtyAvail - newRow.qtyOnPO) * 100) / 100);
			}

			if (newRow.customOrder === "" || newRow.customOrder === null) {
				updatedRow.customOrder = null;
			}

			setPurchasingRows((prev) => prev.map((r) => (r.id === newRow.id ? updatedRow : r)));
			return updatedRow;
		},
		[],
	);

	// ─── Row category class ───────────────────────────────────────────
	const getRowClassName = useCallback(
		(params: { row: GridRowModel }): string => {
			const cat = computeCategoryName(params.row as RequirementRow, categories, displayFactor);
			return cat ? (CATEGORY_CLASS_MAP[cat] ?? "") : "";
		},
		[categories, displayFactor],
	);

	// ─── Filtered rows by selected categories ─────────────────────────
	const filteredPurchasingRows = useMemo(() => {
		if (selectedCategories.length === 0) return purchasingRows;
		return purchasingRows.filter((row) => {
			const cat = computeCategoryName(row as RequirementRow, categories, displayFactor);
			return cat ? selectedCategories.includes(cat) : true;
		});
	}, [purchasingRows, selectedCategories, categories, displayFactor]);

	const filteredBundlingRows = useMemo(() => {
		if (selectedCategories.length === 0) return bundlingRows;
		return bundlingRows.filter((row) => {
			const cat = computeCategoryName(row as BundlingRow, categories, displayFactor);
			return cat ? selectedCategories.includes(cat) : true;
		});
	}, [bundlingRows, selectedCategories, categories, displayFactor]);

	// ─── Excel Export ─────────────────────────────────────────────────
	const purchasingColumnGroupModelRef = useRef<GridColumnGroupingModel>([]);

	const handleExcelExport = useCallback(async () => {
		const dt = dayjs().format("YYYYMMDD_HHmmss");
		const dateRangeStr = dateRange.from && dateRange.to
			? `${dateRange.from.format("YYYYMM")}-${dateRange.to.format("YYYYMM")}`
			: "";
		const storageIDs = selectedStorage.map((s) => s.id).join("-");
		const fileName = `SMR_${selectedPrincipal?.ClassID ?? "UNKNOWN"}_${storageIDs}_${dt}_${frequency}_${dateRangeStr}.xlsx`;

		if (mode === "purchasing") {
			const sortedRowIds = apiRef.current?.getSortedRowIds() ?? [];
			const rowById = new Map(filteredPurchasingRows.map((r) => [r.id, r]));
			const rowsToExport: Record<string, unknown>[] = [];
			for (const id of sortedRowIds) {
				const row = rowById.get(id);
				if (row) rowsToExport.push(row as Record<string, unknown>);
			}
			if (rowsToExport.length === 0) {
				rowsToExport.push(...filteredPurchasingRows.map((r) => r as Record<string, unknown>));
			}

			await exportDataGridToExcel(rowsToExport, purchasingColumns, {
				title: "Stock Movement Report",
				subtitle: selectedPrincipal?.Descr ?? "",
				columnGroupingModel: purchasingColumnGroupModelRef.current,
				getRowFill: (row) => {
					const cat = computeCategoryName(row as unknown as RequirementRow, categories, displayFactor);
					return cat ? (CAT_EXCEL_COLORS[cat] ?? null) : null;
				},
			}, fileName);
		} else {
			await exportDataGridToExcel(bundlingRows as unknown as Record<string, unknown>[], bundlingColumns, undefined, fileName);
		}
	}, [mode, filteredPurchasingRows, bundlingRows, purchasingColumns, bundlingColumns, selectedPrincipal, categories, displayFactor, apiRef, dateRange, frequency, selectedStorage]);

	// ─── Save Purchase Order ──────────────────────────────────────────
	const handleSavePurchaseOrder = useCallback(async (refNum: string) => {
		if (mode !== "purchasing" || purchasingRows.length === 0) return;
		setIsSavingPo(true);
		setGridError(null);
		try {
			const user = useAuthStore.getState().user;
			const createdBy = user?.name ?? "";
			const siteId = selectedStorage.map((s) => s.id).join(",");
			const salesFrom = dateRange.from?.startOf("month").format("YYYY-MM-DD") ?? "";
			const salesTo = dateRange.to?.endOf("month").format("YYYY-MM-DD") ?? "";

			// Flatten rows: include all row fields including periodDemand
			const rows = purchasingRows.map((r) => {
				const row = { ...r } as Record<string, unknown>;
				// Flatten periodDemand into pd_ columns for CSV
				const pd = row.periodDemand as Record<string, number> | undefined;
				if (pd && typeof pd === "object") {
					for (const [key, val] of Object.entries(pd)) {
						row[`pd_${key}`] = val;
					}
				}
				delete row.periodDemand;
				delete row.id;
				delete row.classID;
				return row;
			});

			// Warn if payload exceeds ~5 MB (heuristic: rough JSON serialization estimate)
			const estimatedBytes = JSON.stringify(rows).length;
			if (estimatedBytes > 5_000_000) {
				const mb = (estimatedBytes / 1_000_000).toFixed(1);
				console.warn(`Save PO payload is ~${mb}MB — large payloads may fail.`);
			}

			await apiRequest("/purchase-order", {
				method: "POST",
				body: {
					refNum,
					principalId: selectedPrincipal?.ClassID ?? "",
					siteId,
					demandMode,
					frequency,
					salesFrom,
					salesTo,
					createdBy,
					rows,
				},
			});

			setSavePoDialogOpen(false);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to save purchase order.";
			console.error("Save PO error:", msg);
			setGridError(msg);
			throw err; // re-throw so SavePoDialog can display the error inline
		} finally {
			setIsSavingPo(false);
		}
	}, [mode, purchasingRows, selectedStorage, dateRange, demandMode, frequency]);

	// ─── Column Grouping Models ──────────────────────────────────────
	const purchasingColumnGroupModel = useMemo<GridColumnGroupingModel>(() => {
		const groups: GridColumnGroupingModel = [
			{
				groupId: `${frequency === "monthly" ? "Monthly" : "Weekly"} Demand`,
				headerClassName: "group-demand",
				children: periodKeys.map((key) => ({ field: `pd_${key.replace(/[\s]/g, "_")}` })),
			},
			{
				groupId: `${frequency === "monthly" ? "Monthly" : "Weekly"} Computation`,
				headerClassName: "group-computation",
				children: [
					{ field: "totalDemand" }, { field: "totalDemandCS" },
					{ field: "avgDemand" }, { field: "avgDemandCS" }, { field: "stockCoverCount" },
				],
			},
			{
				groupId: "Order",
				headerClassName: "group-stock",
				children: [
					{ field: "coverageThreshold" }, { field: "suggestedOrder" }, { field: "suggestedOrderCS" },
					{ field: "customOrder" }, { field: "finalOrderCS" }, { field: "orderCover" },
					{ field: "incomingCover" }, { field: "totalCover" }, { field: "amount" },
				],
			},
			{
				groupId: "Inventory",
				headerClassName: "group-inventory",
				children: [{ field: "qtyAlloc" }, { field: "qtyOnPO" }, { field: "qtyOnHand" }, { field: "qtyAvail" }],
			},
			{
				groupId: `Price (${selectedPriceClass})`,
				headerClassName: "group-price",
				children: [{ field: "price_ao" }, { field: "price_perCS" }, { field: "price_perStkUnit" }],
			},
		];
		return groups;
	}, [periodKeys, frequency, selectedPriceClass]);

	const bundlingColumnGroupModel = useMemo<GridColumnGroupingModel>(() => [
		{
			groupId: `${frequency === "monthly" ? "Monthly" : "Weekly"} Demand`,
			headerClassName: "group-demand",
			children: periodKeys.map((key) => ({ field: `pd_${key.replace(/[\s]/g, "_")}` })),
		},
		{
			groupId: `${frequency === "monthly" ? "Monthly" : "Weekly"} Computation`,
			headerClassName: "group-computation",
			children: [{ field: "avgDemand" }, { field: "stockCoverCount" }],
		},
		{
			groupId: "Inventory",
			headerClassName: "group-inventory",
			children: [{ field: "qtyAlloc" }, { field: "qtyOnPO" }, { field: "qtyOnHand" }, { field: "qtyAvail" }],
		},
	], [periodKeys, frequency]);

	// Keep ref in sync for export functions
	useEffect(() => {
		purchasingColumnGroupModelRef.current = purchasingColumnGroupModel;
	}, [purchasingColumnGroupModel]);

	// ─── Persist Form State ──────────────────────────────────────────
	const persistState = useMemo(
		() => ({
			mode,
			selectedPrincipal,
			selectedStorage,
			frequency,
			demandMode,
			dateRange: serializeDateRange(dateRange),
		}),
		[mode, selectedPrincipal, selectedStorage, frequency, demandMode, dateRange],
	);

	useEffect(() => {
		persistFormState(persistState);
	}, [persistState]);

	// ─── Auto-scroll to results after DataGrid renders ────────────────
	useEffect(() => {
		if (applied && (purchasingColumns.length > 0 || bundlingColumns.length > 0)) {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					resultsAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
				});
			});
		}
	}, [applied, purchasingColumns.length, bundlingColumns.length]);

	// ─── Track previous price class for auto-re-fetch ────────────────
	const prevPriceClassRef = useRef<string>(selectedPriceClass);

	useEffect(() => {
		if (!applied || mode !== "purchasing") return;
		const prev = prevPriceClassRef.current;
		if (selectedPriceClass !== prev) {
			prevPriceClassRef.current = selectedPriceClass;
			executeApply();
		}
	}, [selectedPriceClass, applied, mode, executeApply]);

	// ─── Sync price column visibility with selectedPriceClass ────────
	useEffect(() => {
		if (!applied || mode !== "purchasing") return;
		const priceFields = ["price_ao", "price_perCS", "price_perStkUnit"];
		const model = { ...userColumnVisibilityModelRef.current };
		for (const f of priceFields) delete model[f];
		const timer = setTimeout(() => {
			apiRef.current?.setColumnVisibilityModel(model);
		}, 0);
		return () => clearTimeout(timer);
	}, [selectedPriceClass, applied, mode, apiRef]);

	// ─── Return ─────────────────────────────────────────────────────
	return {
		mode,
		setMode,
		darkMode,
		groupColors,
		principals,
		selectedPrincipal,
		setSelectedPrincipal,
		storageLocations,
		selectedStorage,
		setSelectedStorage,
		frequency,
		setFrequency,
		demandMode,
		setDemandMode,
		dateRange,
		setDateRange,
		monthlyValidDays,
		monthlyKeys,
		handleMonthlyValidDayChange,
		applied,
		isApplying,
		gridError,
		setGridError,
		purchasingRows,
		bundlingRows,
		purchasingColumns,
		bundlingColumns,
		filteredPurchasingRows,
		filteredBundlingRows,
		handleApply,
		handleBulkMinStockApply,
		processRowUpdate,
		getRowClassName,
		handleExcelExport,
		bulkMinStock,
		setBulkMinStock,
		selectedPriceClass,
		setSelectedPriceClass,
		showDemandColumns,
		setShowDemandColumns,
		savePoDialogOpen,
		openSavePoDialog,
		closeSavePoDialog,
		isSavingPo,
		handleSavePurchaseOrder,
		priceClasses,
		categories,
		selectedCategories,
		setSelectedCategories,
		apiRef,
		resultsAnchorRef,
		userColumnVisibilityModelRef,
		purchasingColumnGroupModel,
		bundlingColumnGroupModel,
		periodKeys,
		displayFactor,
		existingPoWarningOpen,
		existingPoWarning,
		handleContinueApply,
		closeExistingPoWarning,
	};
}
