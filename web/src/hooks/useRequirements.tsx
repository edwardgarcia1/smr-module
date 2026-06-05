/**
 * useRequirements — Orchestrator hook for the RequirementsPage.
 *
 * Composes smaller hooks:
 * - useRequirementsActions: API calls, grid state, filtering, export, save PO
 *
 * Owns the form/configuration state (mode, filters, date range, lookups).
 */
import {
	useState,
	useMemo,
	useEffect,
	useCallback,
	useRef,
} from "react";
import {
	useGridApiRef,
} from "@mui/x-data-grid";
import type {
	GridColumnGroupingModel,
} from "@mui/x-data-grid";
import dayjs from "dayjs";
import { useThemeMode } from "../providers/AppProvider";
import {
	buildGroupColors,
	loadPersistedForm,
	persistFormState,
	serializeDateRange,
	ALLOWED_SITE_IDS,
} from "../config/requirements";
import type {
	Mode,
	Frequency,
	DemandMode,
	DemandSource,
	Principal,
	StorageLocation,
	MinStockCategory,
	DateRangeItem,
	GroupColors,
} from "../config/requirements";
import apiRequest from "../services/api";
import type { LogoOption } from "../components/requirements/PoPdfExportDialog";
import { useRequirementsActions } from "./useRequirementsActions";
import type { UseRequirementsActionsReturn } from "./useRequirementsActions";

// ─── Logo options (discovered at build time via Vite import.meta.glob) ──────
const logoModules = import.meta.glob<{ default: string }>(
	"../assets/logo/*.{jpg,jpeg,png}",
	{ eager: true },
);
export const LOGO_OPTIONS: LogoOption[] = Object.entries(logoModules)
	.map(([path, mod]) => ({
		name: path.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") ?? path,
		src: mod.default,
	}))
	.sort((a, b) => a.name.localeCompare(b.name));

// ─── Interface ────────────────────────────────────────────────────────

export interface UseRequirementsReturn
	extends UseRequirementsActionsReturn {
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
	demandSource: DemandSource;
	setDemandSource: (s: DemandSource) => void;
	dateRange: DateRangeItem;
	setDateRange: React.Dispatch<React.SetStateAction<DateRangeItem>>;
	monthlyValidDays: Record<string, number>;
	monthlyKeys: string[];
	handleMonthlyValidDayChange: (monthKey: string, value: number) => void;
	priceClasses: string[];
	categories: MinStockCategory[];
	apiRef: ReturnType<typeof useGridApiRef>;
	resultsAnchorRef: React.RefObject<HTMLDivElement | null>;
	userColumnVisibilityModelRef: React.MutableRefObject<Record<string, boolean>>;
	purchasingColumnGroupModel: GridColumnGroupingModel;
	bundlingColumnGroupModel: GridColumnGroupingModel;
}

export function useRequirements(): UseRequirementsReturn {
	const { darkMode } = useThemeMode();

	// ─── Load persisted form ──────────────────────────────────────────
	const persistedForm = useMemo(() => loadPersistedForm(), []);

	// ─── Mode toggle ──────────────────────────────────────────────────
	const [mode, setModeState] = useState<Mode>(
		persistedForm?.mode ?? "purchasing",
	);

	// ─── Theme-aware group colors ─────────────────────────────────────
	const groupColors = useMemo(() => buildGroupColors(darkMode), [darkMode]);

	// ─── Filter state ─────────────────────────────────────────────────
	const [selectedPrincipal, setSelectedPrincipal] =
		useState<Principal | null>(persistedForm?.selectedPrincipal ?? null);
	const [principals, setPrincipals] = useState<Principal[]>([]);
	const [storageLocations, setStorageLocations] = useState<StorageLocation[]>(
		[],
	);
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
	const [demandSource, setDemandSource] = useState<DemandSource>(
		persistedForm?.demandSource ?? "shipped",
	);
	const [monthlyValidDays, setMonthlyValidDays] = useState<
		Record<string, number>
	>({});
	const monthlyKeys = useMemo(
		() => Object.keys(monthlyValidDays).sort(),
		[monthlyValidDays],
	);

	const handleMonthlyValidDayChange = useCallback(
		(monthKey: string, value: number) => {
			setMonthlyValidDays((prev) => ({ ...prev, [monthKey]: value }));
		},
		[],
	);

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

	// ─── Sub-hook: actions (API, grid, filter, export) ────────────────
	const actions = useRequirementsActions({
		mode,
		selectedPrincipal,
		selectedStorage,
		frequency,
		demandMode,
		demandSource,
		dateRange,
		monthlyValidDays,
		priceClasses,
		categories,
	});

	// ─── Mode setter — also resets grid state via sub-hook callback ───
	const resetGridRef = useRef(actions.resetGridState);
	resetGridRef.current = actions.resetGridState;

	const setMode = useCallback((newMode: Mode) => {
		setModeState(newMode);
		// Use setTimeout to ensure the sub-hook has re-rendered with new mode
		// before resetting grid; the ref is always current
		resetGridRef.current();
	}, []);

	// ─── Compute per-month valid days from date range (weekly only) ──
	useEffect(() => {
		if (frequency !== "weekly") {
			setMonthlyValidDays({});
			return;
		}
		const dr = dateRange;
		if (!dr.from || !dr.to) return;
		const monthSet = new Set<string>();
		let current = dr.from.startOf("month");
		while (
			current.isBefore(dr.to) || current.isSame(dr.to, "month")
		) {
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

	// ─── Persist Form State ──────────────────────────────────────────
	const persistState = useMemo(
		() => ({
			mode,
			selectedPrincipal,
			selectedStorage,
			frequency,
			demandMode,
			demandSource,
			dateRange: serializeDateRange(dateRange),
		}),
		[
			mode,
			selectedPrincipal,
			selectedStorage,
			frequency,
			demandMode,
			demandSource,
			dateRange,
		],
	);

	useEffect(() => {
		persistFormState(persistState);
	}, [persistState]);

	// ─── Return: merge form state with action results ─────────────────
	return {
		// Form state
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
		demandSource,
		setDemandSource,
		dateRange,
		setDateRange,
		monthlyValidDays,
		monthlyKeys,
		handleMonthlyValidDayChange,
		priceClasses,
		categories,
		// All actions + grid state
		...actions,
	};
}
