/**
 * PurchaseOrders Page — Lists saved purchase order snapshots from the
 * Requirements purchasing grid. Click a row to view the saved CSV data
 * in a DataGrid.
 */
import React, {
	useEffect,
	useState,
	useCallback,
	useMemo,
	useRef,
} from "react";
import {
	Box,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Paper,
	Alert,
	TablePagination,
	Typography,
	Button,
	Dialog,
	DialogContent,
	IconButton,
	Tooltip,
	TableSortLabel,
	CircularProgress,
	Skeleton,
	TextField,
	Autocomplete,
	Checkbox,
	FormControl,
	Select,
	MenuItem,
	Chip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
	DataGrid,
	type GridColDef,
	ColumnsPanelTrigger,
	FilterPanelTrigger,
	useGridApiRef,
} from "@mui/x-data-grid";
import apiRequest from "../services/api";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import FilterListIcon from "@mui/icons-material/FilterList";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";
import { useThemeMode } from "../providers/AppProvider";
import {
	buildGroupColors,
	computeCategoryName,
	periodSortValue,
	getCategoryColors,
	CATEGORY_CLASS_MAP,
	CATEGORY_ORDER,
	CAT_EXCEL_COLORS,
	ALLOWED_SITE_IDS,
} from "../config/requirements";
import type {
	MinStockCategory,
	CategoryColorScheme,
	Principal,
} from "../config/requirements";
import {
	buildBaseGridSx,
	purchasingGroupSelectors,
} from "../components/requirements/gridStyles";
import CategoryFilter from "../components/requirements/CategoryFilter";
import PoPdfExportDialog from "../components/requirements/PoPdfExportDialog";
import type { PoPdfExportFormData } from "../components/requirements/PoPdfExportDialog";
import { exportDataGridToExcel } from "../utils/exportToExcel";
import { exportPurchaseOrderToPdf } from "../utils/exportToPdf";
import { downloadBlob } from "../utils/download";
import { useAuthStore } from "../store/useAuthStore";
import { LOGO_OPTIONS } from "../hooks/useRequirements";
import dayjs from "dayjs";

// ─── Types ────────────────────────────────────────────────────────────

type PoStatus = "Pending" | "Printed" | "Approved" | "Encoded" | "Cancelled";

interface PurchaseOrder {
	id: number;
	ref_num: string;
	principal_id: string;
	site_id: string;
	demand_mode: string;
	frequency: string;
	sales_from: string;
	sales_to: string;
	csv_filename: string | null;
	created_at: string;
	prepared_by: string;
	last_update_at: string | null;
	last_update_by: string | null;
	status: PoStatus;
	status_from: string | null;
	status_by: string | null;
}

interface PurchaseOrderDetail {
	meta: PurchaseOrder;
	csvData: {
		headers: string[];
		rows: Record<string, string>[];
	};
}

type Order = "asc" | "desc";
type OrderBy = keyof PurchaseOrder;

const PAGE_SIZE_OPTIONS = [10, 20, 50];

// ─── Detail grid column width/label maps (matching RequirementsPage) ──

const DETAIL_COL_WIDTHS: Record<string, number> = {
	invtID: 110,
	descr: 260,
	stkUnit: 90,
	qtyPerCS: 90,
	price_ao: 150,
	price_perCS: 110,
	price_perStkUnit: 110,
	qtyOnHand: 110,
	qtyAvail: 110,
	qtyOnPO: 110,
	qtyAlloc: 110,
	avgDemand: 150,
	avgDemandCS: 120,
	totalDemandCS: 110,
	stockCoverCount: 130,
	coverageThreshold: 100,
	suggestedOrder: 180,
	suggestedOrderCS: 130,
	customOrder: 130,
	amount: 130,
	finalOrderCS: 130,
	orderCover: 130,
	incomingCover: 130,
	totalCover: 140,
	totalDemand: 110,
};

const DETAIL_HEADER_LABELS: Record<string, string> = {
	invtID: "Inventory ID",
	descr: "Description",
	stkUnit: "Stock Unit",
	qtyPerCS: "Qty/CS",
	price_ao: "Last Update",
	price_perCS: "Per CS",
	price_perStkUnit: "Per StkUnit",
	qtyOnHand: "On Hand",
	qtyAvail: "Available",
	qtyOnPO: "Incoming",
	qtyAlloc: "Unreleased",
	avgDemand: "Avg Demand",
	avgDemandCS: "Avg Demand (CS)",
	totalDemandCS: "Total (CS)",
	stockCoverCount: "Stock Cover",
	coverageThreshold: "Min Stock",
	suggestedOrder: "Suggested Order",
	suggestedOrderCS: "Suggested Order (CS)",
	customOrder: "Custom Order (CS)",
	amount: "Amount",
	finalOrderCS: "Final Order (CS)",
	orderCover: "Order Cover",
	incomingCover: "Incoming Cover",
	totalCover: "Total Cover",
	totalDemand: "Total",
	_category: "Category",
};

// ─── Column display order (matching RequirementsPage purchasing grid) ──
// pd_* (period demand) fields are interleaved after qtyAvail, sorted by name.

const DETAIL_COL_ORDER: string[] = [
	"invtID",
	"descr",
	"stkUnit",
	"qtyPerCS",
	"price_ao",
	"price_perCS",
	"price_perStkUnit",
	"qtyAlloc",
	"qtyOnPO",
	"qtyOnHand",
	"qtyAvail",
	"totalDemand",
	"totalDemandCS",
	"avgDemand",
	"avgDemandCS",
	"stockCoverCount",
	"coverageThreshold",
	"suggestedOrder",
	"suggestedOrderCS",
	"customOrder",
	"finalOrderCS",
	"orderCover",
	"incomingCover",
	"totalCover",
	"amount",
	"_category",
];

// Fields that are numeric — right-aligned with decimal formatting
const DETAIL_NUMERIC_FIELDS = new Set([
	"qtyPerCS",
	"price_perCS",
	"price_perStkUnit",
	"qtyOnHand",
	"qtyAvail",
	"qtyOnPO",
	"qtyAlloc",
	"totalDemand",
	"totalDemandCS",
	"avgDemand",
	"avgDemandCS",
	"stockCoverCount",
	"coverageThreshold",
	"suggestedOrder",
	"suggestedOrderCS",
	"customOrder",
	"amount",
	"finalOrderCS",
	"orderCover",
	"incomingCover",
	"totalCover",
]);

// ─── Column group header classes (matching RequirementsPage) ──────────

const DETAIL_HEADER_GROUPS: Record<string, string> = {
	invtID: "group-static",
	descr: "group-static",
	stkUnit: "group-static",
	qtyPerCS: "group-static",
	price_ao: "group-price",
	price_perCS: "group-price",
	price_perStkUnit: "group-price",
	qtyAlloc: "group-inventory",
	qtyOnPO: "group-inventory",
	qtyOnHand: "group-inventory",
	qtyAvail: "group-inventory",
	totalDemand: "group-computation",
	totalDemandCS: "group-computation",
	avgDemand: "group-computation",
	avgDemandCS: "group-computation",
	stockCoverCount: "group-computation",
	coverageThreshold: "group-stock",
	suggestedOrder: "group-stock",
	suggestedOrderCS: "group-stock",
	customOrder: "group-stock",
	finalOrderCS: "group-final-order",
	orderCover: "group-stock",
	incomingCover: "group-stock",
	totalCover: "group-stock",
	amount: "group-stock",
};

const formatDate = (dateStr: string): string => {
	if (!dateStr) return "—";
	try {
		return new Date(dateStr).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	} catch {
		return dateStr;
	}
};

const formatDateTime = (dateStr: string): string => {
	if (!dateStr) return "—";
	try {
		return new Date(dateStr).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return dateStr;
	}
};

const capitalize = (str: string): string => {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// ─── Page Component ───────────────────────────────────────────────────

const PurchaseOrders: React.FC = () => {
	const [orders, setOrders] = useState<PurchaseOrder[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Pagination & sort
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);
	const [order, setOrder] = useState<Order>("desc");
	const [orderBy, setOrderBy] = useState<OrderBy>("created_at");

	// Detail dialog
	const [detailOpen, setDetailOpen] = useState(false);
	const [detailData, setDetailData] = useState<PurchaseOrderDetail | null>(
		null,
	);
	const [detailLoading, setDetailLoading] = useState(false);
	const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);

	const { darkMode } = useThemeMode();
	const groupColors = useMemo(() => buildGroupColors(darkMode), [darkMode]);
	const gridSx = useMemo(
		() =>
			buildBaseGridSx(
				darkMode,
				groupColors,
				purchasingGroupSelectors(groupColors),
			),
		[darkMode, groupColors],
	);

	const [categories, setCategories] = useState<MinStockCategory[]>([]);
	const [principals, setPrincipals] = useState<Principal[]>([]);
	const [storageLocations, setStorageLocations] = useState<
		{ id: string; name: string }[]
	>([]);

	useEffect(() => {
		let cancelled = false;
		apiRequest<{
			sites: { SiteId: string; Name: string }[];
			principals: Principal[];
			minStockCategories: MinStockCategory[];
		}>("/lookups")
			.then((data) => {
				if (!cancelled && data) {
					setCategories(data.minStockCategories ?? []);
					setPrincipals(data.principals ?? []);
					setStorageLocations(
						(data.sites ?? [])
							.filter((s) => ALLOWED_SITE_IDS.has(s.SiteId))
							.map((s) => ({ id: s.SiteId, name: s.Name })),
					);
				}
			})
			.catch(() => {
				/* non-critical */
			});
		return () => {
			cancelled = true;
		};
	}, []);

	// ─── Detail grid: api ref, toolbar state, handlers ───────────

	const detailApiRef = useGridApiRef();
	const detailColumnVisibilityRef = useRef<Record<string, boolean>>({});
	const [detailCategories, setDetailCategories] = useState<string[]>([]);
	const [showDetailDemand, setShowDetailDemand] = useState(true);

	const categoryColors = useMemo(() => getCategoryColors(darkMode), [darkMode]);
	const getCategoryColor = useCallback(
		(cat: string): CategoryColorScheme =>
			categoryColors[cat] ?? {
				bg: "transparent",
				chipBg: "action.selected",
				chipText: "text.primary",
			},
		[categoryColors],
	);

	// ─── List filters ────────────────────────────────────────────

	const [filterPrincipals, setFilterPrincipals] = useState<Principal[]>([]);
	const [filterSites, setFilterSites] = useState<
		{ id: string; name: string }[]
	>([]);
	const [searchRef, setSearchRef] = useState("");

	const filteredOrders = useMemo(() => {
		return orders.filter((po) => {
			if (
				filterPrincipals.length > 0 &&
				!filterPrincipals.some((p) => p.ClassID === po.principal_id)
			)
				return false;
			if (
				filterSites.length > 0 &&
				!filterSites.some((s) => (po.site_id ?? "").split(",").includes(s.id))
			)
				return false;
			if (searchRef.trim()) {
				const q = searchRef.trim().toLowerCase();
				if (!po.ref_num.toLowerCase().includes(q)) return false;
			}
			return true;
		});
	}, [orders, filterPrincipals, filterSites, searchRef]);

	// ─── Fetch list ───────────────────────────────────────────────

	const fetchOrders = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await apiRequest<PurchaseOrder[]>("/purchase-order");
			setOrders(data ?? []);
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : "Failed to load purchase orders.",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchOrders();
	}, [fetchOrders]);

	// ─── Sort / Pagination handlers ──────────────────────────────

	const handleRequestSort = (property: OrderBy) => {
		const isAsc = orderBy === property && order === "asc";
		setOrder(isAsc ? "desc" : "asc");
		setOrderBy(property);
	};

	const handleChangePage = (_event: unknown, newPage: number) => {
		setPage(newPage);
	};

	const handleChangeRowsPerPage = (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		setRowsPerPage(parseInt(event.target.value, 10));
		setPage(0);
	};

	// ─── Sort & paginate ─────────────────────────────────────────

	const sortedOrders = [...filteredOrders].sort((a, b) => {
		const aVal = a[orderBy];
		const bVal = b[orderBy];
		let comparison = 0;
		if (typeof aVal === "string" && typeof bVal === "string") {
			comparison = aVal.localeCompare(bVal);
		} else {
			comparison = (aVal as number) < (bVal as number) ? -1 : 1;
		}
		return order === "asc" ? comparison : -comparison;
	});

	const paginatedOrders = sortedOrders.slice(
		page * rowsPerPage,
		page * rowsPerPage + rowsPerPage,
	);

	// ─── Detail dialog ───────────────────────────────────────────

	const handleOpenDetail = useCallback(async (po: PurchaseOrder) => {
		setSelectedPo(po);
		setDetailLoading(true);
		setDetailOpen(true);
		try {
			const data = await apiRequest<PurchaseOrderDetail>(
				`/purchase-order/${po.id}`,
			);
			setDetailData(data);
		} catch (err: unknown) {
			setDetailData(null);
			setError(
				err instanceof Error ? err.message : "Failed to load PO details.",
			);
		} finally {
			setDetailLoading(false);
		}
	}, []);

	const handleCloseDetail = () => {
		setDetailOpen(false);
		setDetailData(null);
		setSelectedPo(null);
	};

	// ─── Delete ──────────────────────────────────────────────────

	const handleDelete = useCallback(async (id: number) => {
		if (!confirm("Delete this purchase order? This action cannot be undone."))
			return;
		try {
			await apiRequest(`/purchase-order/${id}`, { method: "DELETE" });
			setOrders((prev) => prev.filter((o) => o.id !== id));
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : "Failed to delete purchase order.",
			);
		}
	}, []);

	// ─── Detail grid row class (category highlighting) ───────────
	// Computed from raw fields, matching RequirementsPage logic.

	const getRowClassName = useCallback(
		(params: { row: Record<string, unknown> }) => {
			const r = params.row;
			const stockCoverCount = r.stockCoverCount
				? Number(r.stockCoverCount)
				: null;
			const coverageThreshold = r.coverageThreshold
				? Number(r.coverageThreshold)
				: null;
			const avgDemand = r.avgDemand ? Number(r.avgDemand) : null;
			const suggestedOrder = r.suggestedOrder ? Number(r.suggestedOrder) : null;
			const cat = computeCategoryName(
				{ stockCoverCount, coverageThreshold, avgDemand, suggestedOrder },
				categories,
			);
			return cat ? (CATEGORY_CLASS_MAP[cat] ?? "") : "";
		},
		[categories],
	);

	// ─── Build header columns from CSV headers ───────────────────

	const headerColumns = React.useMemo<GridColDef[]>(() => {
		if (!detailData) return [];

		const orderIdx: Record<string, number> = {};
		DETAIL_COL_ORDER.forEach((name, i) => {
			orderIdx[name] = i;
		});

		const sortedHeaders = [...detailData.csvData.headers].sort((a, b) => {
			const getKey = (h: string): number => {
				const idx = orderIdx[h];
				if (idx !== undefined) return idx;
				if (h.startsWith("pd_")) return 10.5; // between qtyAvail (10) and totalDemand (11)
				return 999; // unknown → end
			};
			const ka = getKey(a);
			const kb = getKey(b);
			if (ka !== kb) return ka - kb;
			// Both pd_* → chronological
			if (a.startsWith("pd_") && b.startsWith("pd_")) {
				return periodSortValue(a.slice(3)) - periodSortValue(b.slice(3));
			}
			// Both unknown → alphabetical
			if (ka === 999) return a.localeCompare(b);
			return 0;
		});

		return sortedHeaders.map((header) => {
			const isPeriodField = header.startsWith("pd_");
			const isNumeric = DETAIL_NUMERIC_FIELDS.has(header) || isPeriodField;
			const isEditable = header === "customOrder";
			const col: GridColDef = {
				field: header,
				headerName:
					DETAIL_HEADER_LABELS[header] ??
					(isPeriodField ? header.slice(3) : header),
				width: DETAIL_COL_WIDTHS[header] ?? (isPeriodField ? 110 : 130),
				flex: header === "descr" ? 1 : undefined,
				headerClassName:
					DETAIL_HEADER_GROUPS[header] ??
					(isPeriodField ? "group-demand" : undefined),
			};
			// Numeric columns: right-aligned with decimal formatting
			if (isNumeric) {
				col.type = "number";
				col.valueFormatter = (value?: string) => {
					if (value == null || value === "") return "";
					const n = Number(value);
					return Number.isNaN(n)
						? value
						: n.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							});
				};
			}
			// Format date fields like price_ao
			if (header === "price_ao") {
				col.valueFormatter = (value?: string) => {
					if (!value) return "—";
					try {
						return new Date(value).toLocaleDateString("en-US", {
							year: "numeric",
							month: "short",
							day: "numeric",
						});
					} catch {
						return value;
					}
				};
			}
			// Inline editing support
			if (isEditable) {
				col.editable = true;
			}
			// Computed field: amount = qty × price per CS
			if (header === "amount") {
				col.valueGetter = (_v: unknown, row: Record<string, unknown>) => {
					const rawC = row.customOrder;
					const rawS = row.suggestedOrderCS;
					const qty =
						rawC != null && rawC !== ""
							? Number(rawC)
							: rawS != null && rawS !== ""
								? Number(rawS)
								: 0;
					const rawP = row.price_perCS;
					const price = rawP != null && rawP !== "" ? Number(rawP) : null;
					if (price == null) return null;
					return Math.round(qty * price * 100) / 100;
				};
			}
			return col;
		});
	}, [detailData]);

	// ─── Computed columns (not in CSV, derived from raw data) ────

	const computedColumns = useMemo<GridColDef[]>(() => {
		if (!detailData) return [];
		const numFmt = (value?: number) => {
			if (value == null) return "";
			return value.toLocaleString(undefined, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			});
		};
		const fixedFmt = (value?: number) => {
			if (value == null) return "";
			return value.toLocaleString(undefined, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			});
		};
		return [
			{
				field: "finalOrderCS",
				headerName: "Final Order (CS)",
				width: 130,
				type: "number",
				headerClassName: "group-final-order",
				valueGetter: (_v: unknown, row: Record<string, unknown>) => {
					const rawC = row.customOrder;
					const rawS = row.suggestedOrderCS;
					const c = rawC != null && rawC !== "" ? Number(rawC) : null;
					const s = rawS != null && rawS !== "" ? Number(rawS) : null;
					return c != null ? c : s;
				},
				valueFormatter: numFmt,
			},
			{
				field: "orderCover",
				headerName: "Order Cover (Months)",
				width: 130,
				type: "number",
				headerClassName: "group-stock",
				valueGetter: (_v: unknown, row: Record<string, unknown>) => {
					const rawC = row.customOrder;
					const rawS = row.suggestedOrderCS;
					const finalQty =
						rawC != null && rawC !== ""
							? Number(rawC)
							: rawS != null && rawS !== ""
								? Number(rawS)
								: null;
					const rawAvgCS = row.avgDemandCS;
					const avgCS =
						rawAvgCS != null && rawAvgCS !== "" ? Number(rawAvgCS) : null;
					if (avgCS == null || avgCS === 0 || finalQty == null) return null;
					return finalQty / avgCS;
				},
				valueFormatter: fixedFmt,
			},
			{
				field: "incomingCover",
				headerName: "Incoming Cover (Months)",
				width: 130,
				type: "number",
				headerClassName: "group-stock",
				valueGetter: (_v: unknown, row: Record<string, unknown>) => {
					const po = row.qtyOnPO != null ? Number(row.qtyOnPO) : null;
					const avg = row.avgDemand != null ? Number(row.avgDemand) : null;
					if (avg == null || avg === 0 || po == null) return null;
					return po / avg;
				},
				valueFormatter: fixedFmt,
			},
			{
				field: "totalCover",
				headerName: "Total Cover (Months)",
				width: 140,
				type: "number",
				headerClassName: "group-stock",
				valueGetter: (_v: unknown, row: Record<string, unknown>) => {
					const rawSc = row.stockCoverCount;
					const sc = rawSc != null && rawSc !== "" ? Number(rawSc) : 0;
					const rawC = row.customOrder;
					const rawS = row.suggestedOrderCS;
					const finalQty =
						rawC != null && rawC !== ""
							? Number(rawC)
							: rawS != null && rawS !== ""
								? Number(rawS)
								: null;
					const rawAvgCS = row.avgDemandCS;
					const avgCS =
						rawAvgCS != null && rawAvgCS !== "" ? Number(rawAvgCS) : null;
					const rawPo = row.qtyOnPO;
					const po = rawPo != null && rawPo !== "" ? Number(rawPo) : 0;
					const rawAvg = row.avgDemand;
					const avg = rawAvg != null && rawAvg !== "" ? Number(rawAvg) : null;
					let orderCover = 0;
					if (avgCS != null && avgCS > 0 && finalQty != null)
						orderCover = finalQty / avgCS;
					let incomingCover = 0;
					if (avg != null && avg > 0 && po > 0) incomingCover = po / avg;
					return sc + orderCover + incomingCover;
				},
				valueFormatter: fixedFmt,
			},
			{
				field: "_category",
				headerName: "Category",
				width: 130,
				valueGetter: (_v: unknown, row: Record<string, unknown>) => {
					const sc = row.stockCoverCount ? Number(row.stockCoverCount) : null;
					const ct = row.coverageThreshold
						? Number(row.coverageThreshold)
						: null;
					const ad = row.avgDemand ? Number(row.avgDemand) : null;
					const so = row.suggestedOrder ? Number(row.suggestedOrder) : null;
					return computeCategoryName(
						{
							stockCoverCount: sc,
							coverageThreshold: ct,
							avgDemand: ad,
							suggestedOrder: so,
						},
						categories,
					);
				},
				sortComparator: (v1: string | null, v2: string | null) => {
					const o1 = v1 ? (CATEGORY_ORDER[v1] ?? 99) : 99;
					const o2 = v2 ? (CATEGORY_ORDER[v2] ?? 99) : 99;
					return o1 - o2;
				},
			},
		];
	}, [detailData, categories]);

	const detailColumns = useMemo<GridColDef[]>(() => {
		const existing = new Set(headerColumns.map((c) => c.field));
		return [
			...headerColumns,
			...computedColumns.filter((c) => !existing.has(c.field)),
		];
	}, [headerColumns, computedColumns]);

	// ─── Detail inline editing ───────────────────────────────────

	const [editedRows, setEditedRows] = useState<
		Record<number, Record<string, unknown>>
	>({});
	const editedRowsRef = useRef(editedRows);
	useEffect(() => {
		editedRowsRef.current = editedRows;
	}, [editedRows]);

	const handleProcessRowUpdate = useCallback(
		(newRow: Record<string, unknown>) => {
			const rowId = newRow.id as number;
			setEditedRows((prev) => ({ ...prev, [rowId]: newRow }));

			// Persist inline edits to server: rebuild full merged rows and PATCH
			if (selectedPo && detailData) {
				const currentEdits = { ...editedRowsRef.current, [rowId]: newRow };
				const mergedRows = detailData.csvData.rows.map((r, i) => {
					const id = i + 1;
					return { ...r, ...(currentEdits[id] ?? {}) };
				});
				const user = useAuthStore.getState().user;
				apiRequest(`/purchase-order/${selectedPo.id}`, {
					method: "PATCH",
					body: { rows: mergedRows },
				}).catch((err) =>
					console.error("Failed to persist inline edit:", err),
				);
			}

			return Promise.resolve(newRow);
		},
		[selectedPo, detailData],
	);

	const handleProcessRowUpdateError = useCallback((err: unknown) => {
		console.error("Row update error:", err);
	}, []);

	// ─── Status change handler ───────────────────────────────────
	const handleStatusChange = useCallback(
		async (newStatus: PoStatus) => {
			if (!selectedPo) return;
			const user = useAuthStore.getState().user;
			try {
				const updated = await apiRequest<PurchaseOrder>(
					`/purchase-order/${selectedPo.id}/status`,
					{
						method: "PATCH",
						body: { status: newStatus },
					},
				);
				// Update the local orders list with new status/metadata
				setOrders((prev) =>
					prev.map((o) =>
						o.id === selectedPo.id
							? {
									...o,
									status: updated.status,
									status_from: updated.status_from,
									status_by: updated.status_by,
								}
							: o,
					),
				);
				setSelectedPo((prev) =>
					prev
						? {
								...prev,
								status: updated.status,
								status_from: updated.status_from,
								status_by: updated.status_by,
							}
						: prev,
				);
			} catch (err) {
				console.error("Failed to update status:", err);
			}
		},
		[selectedPo],
	);

	// ─── List inline status change (no selectedPo dependency) ────
	const handleStatusChangeFromList = useCallback(
		async (poId: number, newStatus: PoStatus) => {
			const user = useAuthStore.getState().user;
			try {
				const updated = await apiRequest<PurchaseOrder>(
					`/purchase-order/${poId}/status`,
					{
						method: "PATCH",
						body: { status: newStatus },
					},
				);
				setOrders((prev) =>
					prev.map((o) =>
						o.id === poId
							? {
									...o,
									status: updated.status,
									status_from: updated.status_from,
									status_by: updated.status_by,
								}
							: o,
					),
				);
			} catch (err) {
				console.error("Failed to update status:", err);
			}
		},
		[],
	);

	// ─── Detail grid toolbar handlers ────────────────────────────

	const handleDetailExcelExport = useCallback(async () => {
		if (!detailData || detailData.csvData.rows.length === 0) return;
		// Merge base CSV rows with inline edits
		const mergedRows = detailData.csvData.rows.map((r, i) => {
			const id = i + 1;
			return { ...(editedRows[id] ?? r), id };
		});
		// Sort rows by the DataGrid's current sort order (category hierarchy, etc.)
		const sortedRowIds = detailApiRef.current?.getSortedRowIds() ?? [];
		const rowById = new Map(mergedRows.map((r) => [r.id, r]));
		const sortedRows: Record<string, unknown>[] = [];
		for (const id of sortedRowIds) {
			const row = rowById.get(id as number);
			if (row) sortedRows.push(row);
		}
		// Fallback: if no sort model active, use merged order
		const exportRows = sortedRows.length > 0 ? sortedRows : mergedRows;
		await exportDataGridToExcel(
			exportRows,
			detailColumns,
			{
				title: selectedPo?.ref_num ?? "Purchase Order",
				subtitle: selectedPo
					? `${selectedPo.frequency} · ${selectedPo.demand_mode} demand · ${selectedPo.principal_id}`
					: undefined,
				getRowFill: (row) => {
					const sc = row.stockCoverCount ? Number(row.stockCoverCount) : null;
					const ct = row.coverageThreshold
						? Number(row.coverageThreshold)
						: null;
					const ad = row.avgDemand ? Number(row.avgDemand) : null;
					const so = row.suggestedOrder ? Number(row.suggestedOrder) : null;
					const cat = computeCategoryName(
						{
							stockCoverCount: sc,
							coverageThreshold: ct,
							avgDemand: ad,
							suggestedOrder: so,
						},
						categories,
					);
					return cat ? (CAT_EXCEL_COLORS[cat] ?? null) : null;
				},
			},
			`PO-${selectedPo?.ref_num ?? "export"}.xlsx`,
		);
	}, [
		detailData,
		detailColumns,
		selectedPo,
		editedRows,
		categories,
		detailApiRef,
	]);

	const handleToggleDetailDemand = useCallback(() => {
		const newShow = !showDetailDemand;
		setShowDetailDemand(newShow);
		const model = { ...detailColumnVisibilityRef.current };
		for (const col of detailColumns) {
			if (col.field.startsWith("pd_")) {
				if (!newShow) {
					model[col.field] = false;
				} else {
					delete model[col.field];
				}
			}
		}
		detailApiRef.current?.setColumnVisibilityModel(model);
	}, [showDetailDemand, detailColumns, detailApiRef]);

	// ─── Detail PDF export ───────────────────────────────────────

	const [pdfDetailOpen, setPdfDetailOpen] = useState(false);
	const [isDetailPdfExporting, setIsDetailPdfExporting] = useState(false);
	const openDetailPdfDialog = useCallback(() => setPdfDetailOpen(true), []);
	const closeDetailPdfDialog = useCallback(() => setPdfDetailOpen(false), []);

	const handleDetailPdfExport = useCallback(
		async (formData: PoPdfExportFormData) => {
			if (!detailData || detailData.csvData.rows.length === 0) return;
			setIsDetailPdfExporting(true);
			try {
				// Merge edited rows so PDF reflects inline edits
				const mergedRows = detailData.csvData.rows.map((r, i) => {
					const id = i + 1;
					return { ...(editedRows[id] ?? r) };
				});
				const poRows = mergedRows
					.map((r) => {
						const rawFinalQty =
							r.customOrder != null && r.customOrder !== ""
								? Number(r.customOrder)
								: r.suggestedOrderCS != null && r.suggestedOrderCS !== ""
									? Number(r.suggestedOrderCS)
									: 0;
						const finalQty = Math.round(rawFinalQty);
						const price = r.price_perCS ? Number(r.price_perCS) : null;
						return {
							invtID: String(r.invtID ?? ""),
							descr: String(r.descr ?? ""),
							qtyPerCS: Number(r.qtyPerCS) || 0,
							price_perCS: price,
							finalOrderCS: finalQty,
							amount:
								price != null ? Math.round(finalQty * price * 100) / 100 : null,
						};
					})
					.filter((r) => r.finalOrderCS !== 0);

				const pdfBuffer = await exportPurchaseOrderToPdf(
					poRows,
					formData.selectedLogoSrc,
					{
						poReference: formData.poReference,
						principalName: (() => {
							const p = principals.find(
								(pr) => pr.ClassID === selectedPo?.principal_id,
							);
							return (
								p?.Descr?.trim() || selectedPo?.principal_id || "Principal"
							);
						})(),
						principalAddress1: selectedPo?.site_id ?? "",
						date: dayjs().format("YYYY-MM-DD"),
						attn: formData.attn,
						preparedBy: formData.preparedBy,
						endorsedBy: formData.endorsedBy,
						checkedBy: formData.checkedBy,
						approvedBy: formData.approvedBy,
						notedBy: formData.notedBy,
					},
				);

				downloadBlob(
					pdfBuffer,
					`PO-${formData.poReference}.pdf`,
					"application/pdf",
				);
				setPdfDetailOpen(false);

				// After successful PDF export, update PO status to "Printed"
				if (selectedPo && selectedPo.status !== "Printed") {
					try {
						const updated = await apiRequest<PurchaseOrder>(
							`/purchase-order/${selectedPo.id}/status`,
							{ method: "PATCH", body: { status: "Printed" } },
						);
						setOrders((prev) =>
							prev.map((o) =>
								o.id === selectedPo.id
									? {
											...o,
											status: updated.status,
											status_from: updated.status_from,
											status_by: updated.status_by,
										}
									: o,
							),
						);
						setSelectedPo((prev) =>
							prev
								? {
										...prev,
										status: updated.status,
										status_from: updated.status_from,
										status_by: updated.status_by,
									}
								: prev,
						);
					} catch (err) {
						console.error("Failed to update PO status after PDF export:", err);
					}
				}
			} catch (err: unknown) {
				console.error("PDF export error:", err);
			} finally {
				setIsDetailPdfExporting(false);
			}
		},
		[detailData, selectedPo, editedRows],
	);

	// ─── Filtered detail rows (by selected categories) ───────────

	const filteredDetailRows = useMemo(() => {
		if (!detailData) return [] as Record<string, unknown>[];
		const rows = detailData.csvData.rows.map((r, i) => {
			const id = i + 1;
			return { ...(editedRows[id] ?? r), id };
		}) as Record<string, unknown>[];
		if (detailCategories.length === 0) return rows;
		return rows.filter((row) => {
			const cat = row._category as string | undefined;
			return cat ? detailCategories.includes(cat) : true;
		});
	}, [detailData, detailCategories, editedRows]);

	// ─── Head cells for the list table ───────────────────────────

	const headCells: { id: OrderBy; label: string }[] = [
		{ id: "ref_num", label: "Ref Nbr" },
		{ id: "principal_id", label: "Principal" },
		{ id: "site_id", label: "Site(s)" },
		{ id: "demand_mode", label: "Demand Mode" },
		{ id: "frequency", label: "Frequency" },
		{ id: "status", label: "Status" },
		{ id: "prepared_by", label: "Prepared By" },
		{ id: "last_update_at", label: "Last Updated" },
		{ id: "last_update_by", label: "Updated By" },
		{ id: "created_at", label: "Created" },
	];

	// ─── Detail grid toolbar ────────────────────────────────────

	const labelSx = { display: { xs: "none", md: "inline" } };

	const toolbarBtnStyle: React.CSSProperties = {
		minWidth: "auto",
		textTransform: "none",
		fontSize: "0.8125rem",
		fontWeight: 500,
		paddingLeft: 6,
		paddingRight: 6,
	};

	const DetailGridToolbar: React.FC = () => (
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
				<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
					<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
						{selectedPo?.ref_num ?? "Purchase Order Data"}
					</Typography>
					{selectedPo && (
						<Select
							size="small"
							value={selectedPo.status}
							onChange={(e) => handleStatusChange(e.target.value as PoStatus)}
							sx={{
								minWidth: 110,
								fontWeight: 600,
								fontSize: "0.8125rem",
								borderRadius: 2,
								"& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" },
							}}
							renderValue={(val) => {
								const chipColors: Record<string, Record<string, string>> = {
									Pending: { bg: "warning.soft", color: "warning.dark" },
									Printed: { bg: "info.soft", color: "info.dark" },
									Approved: { bg: "success.soft", color: "success.dark" },
									Encoded: { bg: "secondary.soft", color: "secondary.dark" },
									Cancelled: { bg: "error.soft", color: "error.dark" },
								};
								const cc = chipColors[val] ?? {};
								return (
									<Chip
										size="small"
										label={val}
										sx={{
											fontWeight: 600,
											fontSize: "0.75rem",
											bgcolor: cc.bg,
											color: cc.color,
											height: 24,
										}}
									/>
								);
							}}
						>
							<MenuItem value="Approved">Approved</MenuItem>
							<MenuItem value="Encoded">Encoded</MenuItem>
							<MenuItem value="Cancelled">Cancelled</MenuItem>
						</Select>
					)}
				</Box>
				<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
					<ColumnsPanelTrigger
						size="small"
						startIcon={<ViewColumnIcon />}
						style={toolbarBtnStyle}
					>
						<Box component="span" sx={labelSx}>
							Columns
						</Box>
					</ColumnsPanelTrigger>
					<FilterPanelTrigger
						size="small"
						startIcon={<FilterListIcon />}
						style={toolbarBtnStyle}
					>
						<Box component="span" sx={labelSx}>
							Filters
						</Box>
					</FilterPanelTrigger>
					<Tooltip title="Export to Excel">
						<Button
							size="small"
							color="primary"
							startIcon={<TableChartIcon />}
							onClick={handleDetailExcelExport}
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
					<Tooltip title="Export to PO PDF">
						<Button
							size="small"
							color="primary"
							startIcon={
								isDetailPdfExporting ? (
									<CircularProgress size={14} thickness={2.5} />
								) : (
									<PictureAsPdfIcon />
								)
							}
							onClick={openDetailPdfDialog}
							disabled={isDetailPdfExporting}
							sx={{
								minWidth: "auto",
								textTransform: "none",
								fontSize: "0.8125rem",
								fontWeight: 500,
								px: 0.75,
							}}
						>
							<Box component="span" sx={labelSx}>
								{isDetailPdfExporting ? "Exporting..." : "PO PDF"}
							</Box>
						</Button>
					</Tooltip>
					<Tooltip title="Close">
						<IconButton
							size="small"
							onClick={handleCloseDetail}
							sx={{ ml: 0.5 }}
						>
							<CloseIcon fontSize="small" />
						</IconButton>
					</Tooltip>
				</Box>
			</Box>
			{selectedPo && (
				<Box
					sx={{
						px: 2,
						pb: 0.5,
					}}
				>
						<Typography variant="body2" color="text.secondary">
							{capitalize(selectedPo.frequency)} ·{" "}
							{capitalize(selectedPo.demand_mode)} demand · Principal:{" "}
							{selectedPo.principal_id} ·{" "}
							{formatDate(selectedPo.sales_from)} –{" "}
							{formatDate(selectedPo.sales_to)}
						</Typography>
				</Box>
			)}
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
				<CategoryFilter
					selectedCategories={detailCategories}
					onChange={setDetailCategories}
					getCategoryColor={getCategoryColor}
				/>
				<Button
					size="small"
					variant="outlined"
					startIcon={
						showDetailDemand ? <VisibilityOffIcon /> : <VisibilityIcon />
					}
					onClick={handleToggleDetailDemand}
					sx={{ textTransform: "none", borderRadius: 2, ml: "auto" }}
				>
					{showDetailDemand ? "Hide" : "Show"} Monthly Demand
				</Button>
			</Box>
		</Box>
	);

	// ─── Render ─────────────────────────────────────────────────

	return (
		<Box
			sx={{
				height: "calc(100dvh - 130px)",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				width: "100%",
			}}
		>
			{error && (
				<Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			)}

			<Paper
				sx={{
					flex: 1,
					overflow: "hidden",
					display: "flex",
					flexDirection: "column",
					borderRadius: 2,
				}}
			>
				{loading ? (
					<Box
						sx={{ p: 3, display: "flex", flexDirection: "column", gap: 1.5 }}
					>
						<Skeleton
							variant="rectangular"
							height={36}
							sx={{ borderRadius: 1 }}
						/>
						<Skeleton
							variant="rectangular"
							height={36}
							sx={{ borderRadius: 1 }}
						/>
						<Skeleton
							variant="rectangular"
							height={36}
							sx={{ borderRadius: 1 }}
						/>
						<Skeleton
							variant="rectangular"
							height={36}
							sx={{ borderRadius: 1 }}
						/>
						<Skeleton
							variant="rectangular"
							height={36}
							sx={{ borderRadius: 1 }}
						/>
					</Box>
				) : orders.length === 0 ? (
					<Box sx={{ p: 4, textAlign: "center" }}>
						<Typography color="text.secondary">
							No saved purchase orders yet. Generate requirements and use the
							"Save" button on the Requirements page to create one.
						</Typography>
					</Box>
				) : (
					<>
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								px: 2,
								pt: 1.5,
								pb: 1,
								borderBottom: "1px solid",
								borderColor: "divider",
							}}
						>
							<Typography
								variant="h6"
								sx={{ fontWeight: 600, fontSize: "1rem" }}
							>
								Purchase Orders
							</Typography>
						</Box>
						<Box
							sx={{
								display: "flex",
								flexWrap: "wrap",
								gap: 2,
								px: 2,
								pt: 2,
								pb: 1,
								alignItems: "center",
							}}
						>
							<TextField
								size="small"
								placeholder="Search ref nbr…"
								value={searchRef}
								onChange={(e) => setSearchRef(e.target.value)}
								slotProps={{
									input: {
										startAdornment: (
											<SearchIcon
												sx={{ mr: 0.5, color: "text.secondary", fontSize: 20 }}
											/>
										),
									},
								}}
								sx={{
									width: 220,
									"& .MuiOutlinedInput-root": { borderRadius: 2 },
								}}
							/>
							<FormControl sx={{ minWidth: 220 }}>
								<Autocomplete
									multiple
									size="small"
									options={principals}
									value={filterPrincipals}
									onChange={(_, newVal) => setFilterPrincipals(newVal)}
									getOptionLabel={(option) =>
										`${option.ClassID} — ${option.Descr}`
									}
									isOptionEqualToValue={(option, val) =>
										option.ClassID === val.ClassID
									}
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
												{option.ClassID} — {option.Descr}
											</li>
										);
									}}
									renderInput={(params) => (
										<TextField
											{...params}
											label="Principal"
											placeholder="Select principals"
											sx={{
												"& .MuiOutlinedInput-root": { borderRadius: 2 },
											}}
										/>
									)}
								/>
							</FormControl>
							<FormControl sx={{ minWidth: 220 }}>
								<Autocomplete
									multiple
									size="small"
									options={storageLocations}
									value={filterSites}
									onChange={(_, newVal) => setFilterSites(newVal)}
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
											label="Site"
											placeholder="Select sites"
											sx={{
												"& .MuiOutlinedInput-root": { borderRadius: 2 },
											}}
										/>
									)}
								/>
							</FormControl>
						</Box>
						{filteredOrders.length === 0 ? (
							<Box sx={{ p: 4, textAlign: "center" }}>
								<Typography color="text.secondary">
									No purchase orders match the current filters.
								</Typography>
							</Box>
						) : (
							<>
								<TableContainer sx={{ flex: 1, overflow: "auto" }}>
									<Table size="small">
										<TableHead>
											<TableRow>
												{headCells.map((hc) => (
													<TableCell
														key={hc.id}
														sortDirection={orderBy === hc.id ? order : false}
														sx={{ fontWeight: 600 }}
													>
														<TableSortLabel
															active={orderBy === hc.id}
															direction={orderBy === hc.id ? order : "asc"}
															onClick={() => handleRequestSort(hc.id)}
														>
															{hc.label}
														</TableSortLabel>
													</TableCell>
												))}
												<TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											{paginatedOrders.map((po) => (
												<TableRow
													key={po.id}
													hover
													sx={{ cursor: "pointer" }}
													onClick={() => handleOpenDetail(po)}
												>
													<TableCell sx={{ fontWeight: 600 }}>
														{po.ref_num}
													</TableCell>
													<TableCell>{po.principal_id}</TableCell>
													<TableCell>
														{po.site_id && po.site_id.trim()
															? po.site_id
															: "ALL SITES"}
													</TableCell>
													<TableCell>
														{capitalize(po.demand_mode)}
													</TableCell>
												<TableCell>
													{capitalize(po.frequency)}
												</TableCell>
												<TableCell
													sx={{ p: 0.5, minWidth: 130 }}
													onClick={(e) => e.stopPropagation()}
												>
													<Select
														size="small"
														value={po.status}
														onChange={(e) => {
															const newStatus = e.target.value as PoStatus;
															handleStatusChangeFromList(po.id, newStatus);
														}}
														sx={{
															minWidth: 110,
															fontWeight: 600,
															fontSize: "0.8125rem",
															borderRadius: 2,
															"& .MuiOutlinedInput-notchedOutline": { border: "none" },
															"& .MuiSelect-select": { py: 0.75 },
														}}
														renderValue={(val) => {
															const chipColors: Record<string, Record<string, string>> = {
																Pending: { bg: "warning.soft", color: "warning.dark" },
																Printed: { bg: "info.soft", color: "info.dark" },
																Approved: { bg: "success.soft", color: "success.dark" },
																Encoded: { bg: "secondary.soft", color: "secondary.dark" },
																Cancelled: { bg: "error.soft", color: "error.dark" },
															};
															const cc = chipColors[val] ?? {};
															return (
																<Chip
																	size="small"
																	label={val}
																	sx={{
																		fontWeight: 600,
																		fontSize: "0.75rem",
																		bgcolor: cc.bg,
																		color: cc.color,
																		height: 24,
																	}}
																/>
															);
														}}
													>
														<MenuItem value="Pending">Pending</MenuItem>
														<MenuItem value="Printed">Printed</MenuItem>
														<MenuItem value="Approved">Approved</MenuItem>
														<MenuItem value="Encoded">Encoded</MenuItem>
														<MenuItem value="Cancelled">Cancelled</MenuItem>
													</Select>
												</TableCell>
												<TableCell>{po.prepared_by || "—"}</TableCell>
												<TableCell>
													{po.last_update_at ? formatDate(po.last_update_at) : "—"}
												</TableCell>
												<TableCell>{po.last_update_by || "—"}</TableCell>
												<TableCell>{formatDateTime(po.created_at)}</TableCell>
													<TableCell>
														<Box
															sx={{ display: "flex", gap: 0.5 }}
															onClick={(e) => e.stopPropagation()}
														>
															<Tooltip title="View details">
																<IconButton
																	size="small"
																	onClick={() => handleOpenDetail(po)}
																>
																	<VisibilityIcon fontSize="small" />
																</IconButton>
															</Tooltip>
															<Tooltip title="Delete">
																<IconButton
																	size="small"
																	color="error"
																	onClick={() => handleDelete(po.id)}
																>
																	<DeleteIcon fontSize="small" />
																</IconButton>
															</Tooltip>
														</Box>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</TableContainer>
								<TablePagination
									component="div"
									count={filteredOrders.length}
									rowsPerPage={rowsPerPage}
									page={page}
									onPageChange={handleChangePage}
									onRowsPerPageChange={handleChangeRowsPerPage}
									labelRowsPerPage="Rows:"
									rowsPerPageOptions={PAGE_SIZE_OPTIONS}
									sx={{
										width: "100%",
										display: "flex",
										flexDirection: { xs: "column", sm: "row" },
										alignItems: "center",
										gap: 1,
										"& .MuiTablePagination-toolbar": {
											flexWrap: "wrap",
											justifyContent: { xs: "center", sm: "flex-end" },
										},
										"& .MuiTablePagination-spacer": {
											display: "none",
										},
									}}
								/>
							</>
						)}
					</>
				)}
			</Paper>

			{/* ── Detail Dialog ──────────────────────────────────────── */}
			<Dialog
				open={detailOpen}
				onClose={handleCloseDetail}
				maxWidth="xl"
				fullWidth
				slotProps={{ paper: { sx: { height: "90dvh" } } }}
			>
				<DialogContent
					sx={{
						p: 0,
						display: "flex",
						flexDirection: "column",
						overflow: "hidden",
					}}
				>
					{detailLoading ? (
						<Box
							sx={{
								p: 3,
								display: "flex",
								flexDirection: "column",
								gap: 1,
								flex: 1,
							}}
						>
							<Skeleton
								variant="rectangular"
								height={32}
								sx={{ borderRadius: 1, mb: 0.5 }}
							/>
							<Box sx={{ display: "flex", gap: 1 }}>
								<Skeleton
									variant="rectangular"
									height={32}
									sx={{ borderRadius: 1, flex: 1 }}
								/>
								<Skeleton
									variant="rectangular"
									height={32}
									sx={{ borderRadius: 1, flex: 1 }}
								/>
								<Skeleton
									variant="rectangular"
									height={32}
									sx={{ borderRadius: 1, flex: 1 }}
								/>
							</Box>
							<Skeleton
								variant="rectangular"
								height={32}
								sx={{ borderRadius: 1 }}
							/>
							<Skeleton
								variant="rectangular"
								height={32}
								sx={{ borderRadius: 1 }}
							/>
							<Skeleton
								variant="rectangular"
								height={32}
								sx={{ borderRadius: 1 }}
							/>
							<Box sx={{ display: "flex", gap: 1 }}>
								<Skeleton
									variant="rectangular"
									height={32}
									sx={{ borderRadius: 1, flex: 1 }}
								/>
								<Skeleton
									variant="rectangular"
									height={32}
									sx={{ borderRadius: 1, flex: 1 }}
								/>
								<Skeleton
									variant="rectangular"
									height={32}
									sx={{ borderRadius: 1, flex: 1 }}
								/>
								<Skeleton
									variant="rectangular"
									height={32}
									sx={{ borderRadius: 1, flex: 1 }}
								/>
							</Box>
						</Box>
					) : detailData && detailData.csvData.rows.length > 0 ? (
						<Box
							sx={{
								flex: 1,
								display: "flex",
								flexDirection: "column",
								overflow: "hidden",
								minHeight: 0,
							}}
						>
							<DataGrid
								apiRef={detailApiRef}
								rows={filteredDetailRows}
								columns={detailColumns}
								getRowHeight={() => 42}
								getRowClassName={getRowClassName}
								editMode="row"
								processRowUpdate={handleProcessRowUpdate}
								onProcessRowUpdateError={handleProcessRowUpdateError}
								showToolbar
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								slots={{
									toolbar: DetailGridToolbar as React.ComponentType<any>,
								}}
								slotProps={{
									toolbar: {} as any,
									pagination: { labelRowsPerPage: "Rows:" },
								}}
								initialState={{
									pagination: { paginationModel: { pageSize: 20 } },
									sorting: { sortModel: [{ field: "_category", sort: "asc" }] },
								}}
								pageSizeOptions={[10, 20, 50]}
								checkboxSelection
								disableRowSelectionOnClick
								sx={gridSx}
							/>
						</Box>
					) : detailData ? (
						<Box sx={{ p: 4, textAlign: "center" }}>
							<Typography color="text.secondary">
								No grid data found in this purchase order.
							</Typography>
						</Box>
					) : (
						<Box sx={{ p: 4, textAlign: "center" }}>
							<Typography color="text.secondary">
								Failed to load purchase order data.
							</Typography>
						</Box>
					)}
				</DialogContent>
			</Dialog>

			{/* ── PDF Export Dialog ──────────────────────────────────── */}
			<PoPdfExportDialog
				key={`pdf-dialog-${pdfDetailOpen}`}
				open={pdfDetailOpen}
				onClose={closeDetailPdfDialog}
				onExport={handleDetailPdfExport}
				initialValues={{ poReference: selectedPo?.ref_num ?? "" }}
				logoOptions={LOGO_OPTIONS}
				isExporting={isDetailPdfExporting}
			/>
		</Box>
	);
};

export default PurchaseOrders;
