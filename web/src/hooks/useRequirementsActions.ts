/**
 * useRequirementsActions — Core business logic actions for the
 * RequirementsPage: apply, save PO, export, bulk min stock update,
 * row editing, and filtered rows.
 *
 * Extracted from the monolithic useRequirements.tsx.
 */
import {
	useState,
	useCallback,
	useMemo,
	useEffect,
	useRef,
} from "react";
import dayjs from "dayjs";
import {
	useGridApiRef,
} from "@mui/x-data-grid";
import type {
	GridColDef,
	GridRowModel,
	GridColumnGroupingModel,
} from "@mui/x-data-grid";
import apiRequest from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import { exportDataGridToExcel } from "../utils/exportToExcel";
import {
	computeCategoryName,
	periodSortValue,
	CATEGORY_CLASS_MAP,
	CAT_EXCEL_COLORS,
} from "../config/requirements";
import type {
	Mode,
	Frequency,
	DemandMode,
	DemandSource,
	Principal,
	StorageLocation,
	MinStockCategory,
	RequirementRow,
	BundlingRow,
	DateRangeItem,
} from "../config/requirements";
import type { ConflictingPo } from "../components/requirements/ExistingPoWarningDialog";
import {
	buildPurchasingCols,
	buildBundlingCols,
	buildPurchasingColumnGroupModel,
	buildBundlingColumnGroupModel,
} from "./useRequirementsColumns";

// ─── Interface ────────────────────────────────────────────────────────

export interface UseRequirementsActionsReturn {
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
	handleApply: () => Promise<void>;
	handleBulkMinStockApply: () => Promise<void>;
	processRowUpdate: (newRow: GridRowModel, oldRow: GridRowModel) => Promise<GridRowModel>;
	getRowClassName: (params: { row: GridRowModel }) => string;
	handleExcelExport: () => Promise<void>;
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
	handleContinueApply: () => Promise<void>;
	closeExistingPoWarning: () => void;
	resetGridState: () => void;
}

interface UseRequirementsActionsParams {
	mode: Mode;
	selectedPrincipal: Principal | null;
	selectedStorage: StorageLocation[];
	frequency: Frequency;
	demandMode: DemandMode;
	demandSource: DemandSource;
	dateRange: DateRangeItem;
	monthlyValidDays: Record<string, number>;
	priceClasses: string[];
	categories: MinStockCategory[];
}

export function useRequirementsActions(
	params: UseRequirementsActionsParams,
): UseRequirementsActionsReturn {
	const {
		mode,
		selectedPrincipal,
		selectedStorage,
		frequency,
		demandMode,
		demandSource,
		dateRange,
		monthlyValidDays,
		categories,
	} = params;

	// ─── Grid state ───────────────────────────────────────────────
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

	// ─── Existing PO warning dialog state ─────────────────────────
	const [existingPoWarningOpen, setExistingPoWarningOpen] = useState(false);
	const [existingPoWarning, setExistingPoWarning] = useState<ConflictingPo[]>([]);
	const closeExistingPoWarning = useCallback(() => {
		setExistingPoWarningOpen(false);
	}, []);

	// ─── Toolbar states ───────────────────────────────────────────
	const [bulkMinStock, setBulkMinStock] = useState<string>("1.0");
	const [selectedPriceClass, setSelectedPriceClass] = useState<string>("COST");
	const [showDemandColumns, setShowDemandColumns] = useState(true);

	// ─── Refs ─────────────────────────────────────────────────────
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

	// ─── Core Apply Logic ──────────────────────────────────────
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
			const paramsUrl = new URLSearchParams();
			paramsUrl.set("classID", selectedPrincipal.ClassID);
			paramsUrl.set("frequency", frequency);
			paramsUrl.set("priceClass", selectedPriceClass);
			if (demandMode === "highest") paramsUrl.set("demandMode", "highest");
			if (demandSource === "ordered") paramsUrl.set("demandSource", "ordered");
			if (frequency === "weekly") {
				const totalVD = Object.values(monthlyValidDays).reduce(
					(s, v) => s + v,
					0,
				);
				if (totalVD > 0) {
					paramsUrl.set("validDays", String(totalVD));
					paramsUrl.set("monthlyValidDays", JSON.stringify(monthlyValidDays));
				}
			}

			paramsUrl.set(
				"dateRange",
				`${dateRange.from.startOf("month").format("YYYY-MM-DD")},${dateRange.to.endOf("month").format("YYYY-MM-DD")}`,
			);
			for (const s of selectedStorage) paramsUrl.append("siteID", s.id);

			const endpoint =
				mode === "purchasing"
					? "/purchasing/requirements"
					: "/bundling/requirements";
			const data = await apiRequest<RequirementRow[] | BundlingRow[]>(
				`${endpoint}?${paramsUrl.toString()}`,
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

			const keys = Object.keys(data[0].periodDemand ?? {}).sort(
				(a, b) => periodSortValue(a) - periodSortValue(b),
			);
			periodKeysRef.current = keys;
			setPeriodKeys(keys);

			const totalVD = Object.values(monthlyValidDays).reduce(
				(s, v) => s + v,
				0,
			);
			const df =
				frequency !== "weekly" || keys.length === 0 || totalVD === 0
					? 1.0
					: (() => {
							const uniqueMonths = new Set(
								keys.map((k) => {
									const m = k.match(/W\d+\s+(.+)/);
									return m ? m[1] : k;
								}),
							);
							const nMonths = uniqueMonths.size;
							return nMonths > 0 ? (totalVD / 6) / nMonths : 1.0;
						})();
			setDisplayFactor(df);
			displayFactorRef.current = df;

			const gridRows = data.map((item, idx) => ({
				...item,
				id: idx + 1,
			}));

			if (mode === "purchasing") {
				const dynamicCols = buildPurchasingCols(
					frequency,
					demandMode,
					keys,
					df,
					categoriesRef,
					displayFactorRef,
				);
				setPurchasingColumns(dynamicCols);
				setPurchasingRows(gridRows);
			} else {
				const dynamicCols = buildBundlingCols(
					frequency,
					demandMode,
					keys,
					df,
					categoriesRef,
					displayFactorRef,
				);
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
		mode,
		selectedPrincipal,
		selectedStorage,
		dateRange,
		frequency,
		demandSource,
		demandMode,
		monthlyValidDays,
		selectedPriceClass,
	]);

	// ─── Handle Apply (with PO conflict check) ─────────────────
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

		if (mode === "purchasing" && selectedPrincipal) {
			try {
				const conflicting = await apiRequest<ConflictingPo[]>(
					`/purchase-order/check/${encodeURIComponent(selectedPrincipal.ClassID)}`,
				);
				if (conflicting && conflicting.length > 0) {
					setExistingPoWarning(conflicting);
					setExistingPoWarningOpen(true);
					return;
				}
			} catch {
				// Non-blocking
			}
		}

		await executeApply();
	}, [
		mode,
		selectedPrincipal,
		dateRange,
		selectedStorage,
		frequency,
		demandSource,
		demandMode,
		monthlyValidDays,
		selectedPriceClass,
		executeApply,
	]);

	// ─── Bulk min stock update ─────────────────────────────────
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
				/* create new */
			}

			if (principalId) {
				await apiRequest(`/min-stock/principals/${principalId}`, {
					method: "PUT",
					body: { min_stock: val },
				});
			} else {
				await apiRequest("/min-stock/principals", {
					method: "POST",
					body: {
						class_id: selectedPrincipal.ClassID,
						min_stock: val,
					},
				});
			}

			await executeApply();
		} catch (err: unknown) {
			setGridError(
				err instanceof Error
					? err.message
					: "Failed to update principal min stock.",
			);
		} finally {
			setIsApplying(false);
		}
	}, [bulkMinStock, selectedPrincipal, frequency, executeApply]);

	// ─── Grid Edit Handler ─────────────────────────────────────
	const processRowUpdate = useCallback(
		async (newRow: GridRowModel, oldRow: GridRowModel) => {
			const updatedRow = { ...newRow };

			if (
				newRow.coverageThreshold !== oldRow.coverageThreshold
			) {
				await apiRequest(
					`/min-stock/settings/${newRow.invtID}`,
					{
						method: "PATCH",
						body: { min_stock_setting: "Custom" },
					},
				);

				let itemId: number | null = null;
				try {
					const existing = await apiRequest<{ id: number }>(
						`/min-stock/items/invt/${newRow.invtID}`,
					);
					itemId = existing.id;
				} catch {
					/* create new */
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
					Math.round(
						(targetStock - newRow.qtyAvail - newRow.qtyOnPO) * 100,
					) / 100,
				);
			}

			if (
				newRow.customOrder === "" ||
				newRow.customOrder === null
			) {
				updatedRow.customOrder = null;
			}

			setPurchasingRows((prev) =>
				prev.map((r) =>
					r.id === newRow.id ? updatedRow : r,
				),
			);
			return updatedRow;
		},
		[],
	);

	// ─── Row category class ────────────────────────────────────
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

	// ─── Filtered rows by selected categories ──────────────────
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

	// ─── Column Grouping Models ────────────────────────────────
	const purchasingColumnGroupModel = useMemo(
		() =>
			buildPurchasingColumnGroupModel(
				periodKeys,
				frequency,
				selectedPriceClass,
			),
		[periodKeys, frequency, selectedPriceClass],
	);

	const bundlingColumnGroupModel = useMemo(
		() => buildBundlingColumnGroupModel(periodKeys, frequency),
		[periodKeys, frequency],
	);

	const purchasingColumnGroupModelRef = useRef<GridColumnGroupingModel>([]);
	useEffect(() => {
		purchasingColumnGroupModelRef.current = purchasingColumnGroupModel;
	}, [purchasingColumnGroupModel]);

	// ─── Excel Export ──────────────────────────────────────────
	const handleExcelExport = useCallback(async () => {
		const dt = dayjs().format("YYYYMMDD_HHmmss");
		const dateRangeStr =
			dateRange.from && dateRange.to
				? `${dateRange.from.format("YYYYMM")}-${dateRange.to.format("YYYYMM")}`
				: "";
		const storageIDs = selectedStorage.map((s) => s.id).join("-");
		const fileName = `SMR_${selectedPrincipal?.ClassID ?? "UNKNOWN"}_${storageIDs}_${dt}_${frequency}_${dateRangeStr}.xlsx`;

		if (mode === "purchasing") {
			const sortedRowIds = apiRef.current?.getSortedRowIds() ?? [];
			const rowById = new Map(
				filteredPurchasingRows.map((r) => [r.id, r]),
			);
			const rowsToExport: Record<string, unknown>[] = [];
			for (const id of sortedRowIds) {
				const row = rowById.get(id);
				if (row)
					rowsToExport.push(row as Record<string, unknown>);
			}
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
					columnGroupingModel:
						purchasingColumnGroupModelRef.current,
					getRowFill: (row) => {
						const cat = computeCategoryName(
							row as unknown as RequirementRow,
							categories,
							displayFactor,
						);
						return cat
							? CAT_EXCEL_COLORS[cat] ?? null
							: null;
					},
				},
				fileName,
			);
		} else {
			await exportDataGridToExcel(
				bundlingRows as unknown as Record<string, unknown>[],
				bundlingColumns,
				undefined,
				fileName,
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
		dateRange,
		frequency,
		selectedStorage,
	]);

	// ─── Save Purchase Order ───────────────────────────────────
	const handleSavePurchaseOrder = useCallback(
		async (refNum: string) => {
			if (mode !== "purchasing" || purchasingRows.length === 0) return;
			setIsSavingPo(true);
			setGridError(null);
			try {
				const user = useAuthStore.getState().user;
				const createdBy = user?.name ?? "";
				const siteId = selectedStorage.map((s) => s.id).join(",");
				const salesFrom =
					dateRange.from?.startOf("month").format("YYYY-MM-DD") ?? "";
				const salesTo =
					dateRange.to?.endOf("month").format("YYYY-MM-DD") ?? "";

				const rows = purchasingRows.map((r) => {
					const row = { ...r } as Record<string, unknown>;
					const pd = row.periodDemand as
						| Record<string, number>
						| undefined;
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

				const estimatedBytes = JSON.stringify(rows).length;
				if (estimatedBytes > 5_000_000) {
					const mb = (estimatedBytes / 1_000_000).toFixed(1);
					console.warn(
						`Save PO payload is ~${mb}MB — large payloads may fail.`,
					);
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
				const msg =
					err instanceof Error
						? err.message
						: "Failed to save purchase order.";
				console.error("Save PO error:", msg);
				setGridError(msg);
				throw err;
			} finally {
				setIsSavingPo(false);
			}
		},
		[
			mode,
			purchasingRows,
			selectedStorage,
			dateRange,
			demandMode,
			frequency,
			selectedPrincipal,
		],
	);

	// ─── Auto-scroll to results ────────────────────────────────
	useEffect(() => {
		if (
			applied &&
			(purchasingColumns.length > 0 || bundlingColumns.length > 0)
		) {
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

	// ─── Track previous price class for auto-re-fetch ──────────
	const prevPriceClassRef = useRef<string>(selectedPriceClass);
	useEffect(() => {
		if (!applied || mode !== "purchasing") return;
		const prev = prevPriceClassRef.current;
		if (selectedPriceClass !== prev) {
			prevPriceClassRef.current = selectedPriceClass;
			executeApply();
		}
	}, [selectedPriceClass, applied, mode, executeApply]);

	// ─── Sync price column visibility ──────────────────────────
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

	// ─── Grid reset (called by parent when mode changes) ─────────
	const resetGridState = useCallback(() => {
		setApplied(false);
		setGridError(null);
		setPurchasingRows([]);
		setBundlingRows([]);
		setPurchasingColumns([]);
		setBundlingColumns([]);
	}, []);

	return {
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
		savePoDialogOpen,
		openSavePoDialog,
		closeSavePoDialog,
		isSavingPo,
		handleSavePurchaseOrder,
		showDemandColumns,
		setShowDemandColumns,
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
		resetGridState,
	};
}
