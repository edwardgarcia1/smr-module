import React, { useState, useCallback, useMemo, useEffect } from "react";
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
	Dialog,
	DialogTitle,
	DialogContent,
	DialogContentText,
	DialogActions,
	List,
	ListItem,
	ListItemText,
	ListItemSecondaryAction,
	Alert,
	Tooltip,
	Chip,
	Checkbox,
	CircularProgress,
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
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SettingsIcon from "@mui/icons-material/Settings";
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

// ─── Types ───────────────────────────────────────────────────────────────────

type Frequency = "weekly" | "monthly";

interface Principal {
	id: number;
	name: string;
}

interface PrincipalOption {
	principal: Principal;
	category: "immediate" | "secondary" | "monitoring";
}

interface StorageLocation {
	id: number;
	name: string;
}

interface ProductRow {
	id: number;
	principalId: number;
	storageIds: number[];
	priceClass: string;
	code: string;
	description: string;
	currentLevel: number;
	inputUoM: string;
	qtyOnHand: number;
	unreleasedSO: number;
	incomingPO: number;
	monthlyDemand: Record<string, number>;
	highestMonthlyDemand: number;
	monthlyFactor: number;
	suggestedOrder: number;
	customOrder: number | null;
}

// ─── Placeholder Data ────────────────────────────────────────────────────────

const defaultStorageLocations: StorageLocation[] = [
	{ id: 1, name: "Main Warehouse" },
	{ id: 2, name: "Cold Storage" },
	{ id: 3, name: "Distribution Center" },
];

const placeholderPrincipals: Principal[] = [
	{ id: 1, name: "ZESTO CORPORATION" },
	{ id: 2, name: "PRIME GLOBAL CORPORATION" },
	{ id: 3, name: "ZUELLIG PHARMA CORPORATION" },
	{ id: 4, name: "MULTIRICH FOODS CORPORATION" },
	{ id: 5, name: "W.L. FOOD PRODUCTS" },
	{ id: 6, name: "JIA2 CORPORATION" },
];

const placeholderProducts: ProductRow[] = [
	// ── ZESTO CORPORATION (principal 1) ──
	{
		id: 1,
		principalId: 1,
		storageIds: [1],
		priceClass: "A",
		code: "ZES030",
		description: "BB - Zesto Fruit Soda Calamansi 330ml x 24cs",
		currentLevel: 120,
		inputUoM: "cs",
		qtyOnHand: 120,
		unreleasedSO: 10,
		incomingPO: 50,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
	{
		id: 2,
		principalId: 1,
		storageIds: [1, 2],
		priceClass: "B",
		code: "ZES039",
		description: "BB - Zesto Fruit Soda Calamansi 500ml x 12cs FG",
		currentLevel: 85,
		inputUoM: "cs",
		qtyOnHand: 85,
		unreleasedSO: 5,
		incomingPO: 30,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
	{
		id: 3,
		principalId: 1,
		storageIds: [1],
		priceClass: "B",
		code: "ZES051",
		description: "BB - Zesto Grape Drink 330ml x 24cs",
		currentLevel: 200,
		inputUoM: "cs",
		qtyOnHand: 200,
		unreleasedSO: 20,
		incomingPO: 0,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
	{
		id: 4,
		principalId: 1,
		storageIds: [2],
		priceClass: "A",
		code: "ZES032",
		description: "BB - Zesto Light Root Beer 330ml x 24cs",
		currentLevel: 55,
		inputUoM: "cs",
		qtyOnHand: 55,
		unreleasedSO: 3,
		incomingPO: 100,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
	// ── PRIME GLOBAL CORPORATION (principal 2) ──
	{
		id: 5,
		principalId: 2,
		storageIds: [1, 3],
		priceClass: "A",
		code: "PGC001",
		description: "Prime Rice Premium 25kg",
		currentLevel: 90,
		inputUoM: "sack",
		qtyOnHand: 90,
		unreleasedSO: 15,
		incomingPO: 200,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
	{
		id: 6,
		principalId: 2,
		storageIds: [1],
		priceClass: "A",
		code: "PGC002",
		description: "Prime Cooking Oil 1L x 12s",
		currentLevel: 60,
		inputUoM: "cs",
		qtyOnHand: 60,
		unreleasedSO: 8,
		incomingPO: 25,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
	{
		id: 7,
		principalId: 2,
		storageIds: [3],
		priceClass: "C",
		code: "PGC003",
		description: "Prime Canned Sardines 155g x 48cs",
		currentLevel: 300,
		inputUoM: "cs",
		qtyOnHand: 300,
		unreleasedSO: 50,
		incomingPO: 0,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
	// ── ZUELLIG PHARMA CORPORATION (principal 3) ──
	{
		id: 8,
		principalId: 3,
		storageIds: [1],
		priceClass: "A",
		code: "ZPC001",
		description: "Biogesic Paracetamol 500mg x 100s",
		currentLevel: 45,
		inputUoM: "box",
		qtyOnHand: 45,
		unreleasedSO: 2,
		incomingPO: 100,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
	{
		id: 9,
		principalId: 3,
		storageIds: [1, 2],
		priceClass: "B",
		code: "ZPC003",
		description: "Decolgen Tablet x 20s",
		currentLevel: 180,
		inputUoM: "box",
		qtyOnHand: 180,
		unreleasedSO: 25,
		incomingPO: 500,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
	{
		id: 10,
		principalId: 3,
		storageIds: [1],
		priceClass: "A",
		code: "ZPC002",
		description: "Neozep Forte Tablet x 20s",
		currentLevel: 30,
		inputUoM: "box",
		qtyOnHand: 30,
		unreleasedSO: 1,
		incomingPO: 200,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
	// ── MULTIRICH FOODS CORPORATION (principal 4) ──
	{
		id: 11,
		principalId: 4,
		storageIds: [2],
		priceClass: "C",
		code: "MFC001",
		description: "Multirich Corned Beef 260g x 24cs",
		currentLevel: 75,
		inputUoM: "cs",
		qtyOnHand: 75,
		unreleasedSO: 12,
		incomingPO: 60,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
	{
		id: 12,
		principalId: 4,
		storageIds: [2, 3],
		priceClass: "B",
		code: "MFC002",
		description: "Multirich Meat Loaf 340g x 24cs",
		currentLevel: 40,
		inputUoM: "cs",
		qtyOnHand: 40,
		unreleasedSO: 5,
		incomingPO: 0,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
	// ── W.L. FOOD PRODUCTS (principal 5) ──
	{
		id: 13,
		principalId: 5,
		storageIds: [3],
		priceClass: "C",
		code: "WLF001",
		description: "W.L. Premium Coffee 200g x 12",
		currentLevel: 25,
		inputUoM: "box",
		qtyOnHand: 25,
		unreleasedSO: 0,
		incomingPO: 50,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
	{
		id: 14,
		principalId: 5,
		storageIds: [1, 3],
		priceClass: "A",
		code: "WLF002",
		description: "W.L. Special Noodles 500g x 20",
		currentLevel: 150,
		inputUoM: "box",
		qtyOnHand: 150,
		unreleasedSO: 30,
		incomingPO: 100,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
	// ── JIA2 CORPORATION (principal 6) ──
	{
		id: 15,
		principalId: 6,
		storageIds: [1, 2, 3],
		priceClass: "B",
		code: "JIA001",
		description: "Jia2 Soy Sauce 1L x 12",
		currentLevel: 90,
		inputUoM: "cs",
		qtyOnHand: 90,
		unreleasedSO: 7,
		incomingPO: 30,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
	{
		id: 16,
		principalId: 6,
		storageIds: [2],
		priceClass: "C",
		code: "JIA002",
		description: "Jia2 Fish Sauce 500ml x 24",
		currentLevel: 110,
		inputUoM: "cs",
		qtyOnHand: 110,
		unreleasedSO: 9,
		incomingPO: 0,
		monthlyDemand: {},
		highestMonthlyDemand: 0,
		monthlyFactor: 1.5,
		suggestedOrder: 0,
		customOrder: null,
	},
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateMonthLabels(
	from: Dayjs,
	to: Dayjs,
	freq: Frequency,
): string[] {
	const labels: string[] = [];
	let current = from.startOf("month");
	const end = to.startOf("month");

	while (current.isBefore(end) || current.isSame(end, "month")) {
		labels.push(current.format("MMM YYYY"));
		if (freq === "monthly") {
			current = current.add(1, "month");
		} else {
			current = current.add(1, "week");
		}
	}
	return labels;
}

function fillDemandData(
	products: ProductRow[],
	monthLabels: string[],
	defaultFactor: number,
): ProductRow[] {
	return products.map((product) => {
		const demand: Record<string, number> = {};
		monthLabels.forEach((label) => {
			// Generate semi-random but deterministic placeholder demand
			const seed = product.id + label.charCodeAt(0) + label.length;
			demand[label] =
				Math.round((Math.abs(Math.sin(seed)) * 200 + 20) * 100) / 100;
		});

		const values = Object.values(demand);
		const highest = values.length > 0 ? Math.max(...values) : 0;
		const factor = defaultFactor;

		return {
			...product,
			monthlyDemand: demand,
			highestMonthlyDemand: highest,
			monthlyFactor: factor,
			suggestedOrder: Math.round(highest * factor * 100) / 100,
		};
	});
}

// ─── Form State Persistence ───────────────────────────────────────────────────

const FORM_STORAGE_KEY = "pr-form-state-v3";

interface PersistedFormState {
	selectedPrincipal: PrincipalOption | null;
	selectedStorage: StorageLocation[];
	selectedPriceClasses: string[];
	storageLocations: StorageLocation[];
	frequency: Frequency;
	monthlyFactor: number;
	poRefNbr: string;
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
	if (!serialized || serialized.length === 0)
		return [{ from: null, to: null }];
	return serialized.map((r) => ({
		from: r.from ? dayjs(r.from) : null,
		to: r.to ? dayjs(r.to) : null,
	}));
}

// ─── Storage CRUD Dialog ─────────────────────────────────────────────────────

interface StorageDialogProps {
	open: boolean;
	onClose: () => void;
	locations: StorageLocation[];
	onSave: (locations: StorageLocation[]) => void;
}

const StorageDialog: React.FC<StorageDialogProps> = ({
	open,
	onClose,
	locations,
	onSave,
}) => {
	const [items, setItems] = useState<StorageLocation[]>(locations);
	const [editName, setEditName] = useState("");
	const [editingId, setEditingId] = useState<number | null>(null);
	const [nextId, setNextId] = useState(
		Math.max(0, ...locations.map((l) => l.id)) + 1,
	);

	const handleAdd = () => {
		if (!editName.trim()) return;
		if (editingId !== null) {
			setItems((prev) =>
				prev.map((loc) =>
					loc.id === editingId ? { ...loc, name: editName.trim() } : loc,
				),
			);
			setEditingId(null);
		} else {
			setItems((prev) => [...prev, { id: nextId, name: editName.trim() }]);
			setNextId((n) => n + 1);
		}
		setEditName("");
	};

	const handleEdit = (loc: StorageLocation) => {
		setEditName(loc.name);
		setEditingId(loc.id);
	};

	const handleDelete = (id: number) => {
		setItems((prev) => prev.filter((loc) => loc.id !== id));
		if (editingId === id) {
			setEditingId(null);
			setEditName("");
		}
	};

	const handleSave = () => {
		onSave(items);
		onClose();
	};

	const handleCancel = () => {
		setItems(locations);
		setEditName("");
		setEditingId(null);
		onClose();
	};

	return (
		<Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
			<DialogTitle>Manage Storage Locations</DialogTitle>
			<DialogContent>
				<DialogContentText sx={{ mb: 2 }}>
					Add, edit, or remove inventory storage locations.
				</DialogContentText>

				<Box sx={{ display: "flex", gap: 1, mb: 2 }}>
					<TextField
						size="small"
						fullWidth
						placeholder="Location name"
						value={editName}
						onChange={(e) => setEditName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleAdd();
						}}
					/>
					<Button
						variant="contained"
						onClick={handleAdd}
						disabled={!editName.trim()}
					>
						{editingId !== null ? "Update" : "Add"}
					</Button>
				</Box>

				<List dense>
					{items.map((loc) => (
						<ListItem key={loc.id}>
							<ListItemText primary={loc.name} />
							<ListItemSecondaryAction>
								<IconButton
									edge="end"
									size="small"
									onClick={() => handleEdit(loc)}
									sx={{ mr: 1 }}
								>
									<EditIcon fontSize="small" />
								</IconButton>
								<IconButton
									edge="end"
									size="small"
									onClick={() => handleDelete(loc.id)}
									color="error"
								>
									<DeleteIcon fontSize="small" />
								</IconButton>
							</ListItemSecondaryAction>
						</ListItem>
					))}
					{items.length === 0 && (
						<ListItem>
							<ListItemText
								primary="No storage locations added yet."
								slotProps={{
									primary: {
										sx: { color: "text.secondary", fontStyle: "italic" },
									},
								}}
							/>
						</ListItem>
					)}
				</List>
			</DialogContent>
			<DialogActions>
				<Button onClick={handleCancel}>Cancel</Button>
				<Button onClick={handleSave} variant="contained">
					Save
				</Button>
			</DialogActions>
		</Dialog>
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

	// Principal
	const [selectedPrincipal, setSelectedPrincipal] = useState<PrincipalOption | null>(
		persistedForm?.selectedPrincipal ?? null,
	);
	const principalCategoryMap: Record<number, string> = {
		1: "immediate",
		2: "immediate",
		3: "secondary",
		4: "secondary",
		5: "monitoring",
		6: "monitoring",
	};
	const principalOptions: PrincipalOption[] = placeholderPrincipals.map((p) => ({
		principal: p,
		category: principalCategoryMap[p.id] as "immediate" | "secondary" | "monitoring",
	}));

	// Filters
	const [storageLocations, setStorageLocations] = useState<StorageLocation[]>(
		persistedForm?.storageLocations ?? defaultStorageLocations,
	);
	const [selectedStorage, setSelectedStorage] = useState<StorageLocation[]>(
		persistedForm?.selectedStorage ?? [],
	);
	const priceClasses = ["A", "B", "C"];
	const [selectedPriceClasses, setSelectedPriceClasses] = useState<string[]>(
		persistedForm?.selectedPriceClasses ?? [],
	);
	const [storageDialogOpen, setStorageDialogOpen] = useState(false);

	// Date range list
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

	// Computation
	const [frequency, setFrequency] = useState<Frequency>(
		persistedForm?.frequency ?? "monthly",
	);
	const [monthlyFactor, setMonthlyFactor] = useState(
		persistedForm?.monthlyFactor ?? 1.5,
	);
	const [poRefNbr, setPoRefNbr] = useState(
		persistedForm?.poRefNbr ?? "",
	);

	// Grid data
	const [rows, setRows] = useState<GridRowsProp>([]);
	const [columns, setColumns] = useState<GridColDef[]>([]);
	const [gridError, setGridError] = useState<string | null>(null);
	const [applied, setApplied] = useState(false);
	const [isApplying, setIsApplying] = useState(false);

	// ─── Apply Handler ────────────────────────────────────────────────────

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
		if (dateRanges.length === 0 || dateRanges.some((dr) => !dr.from || !dr.to)) {
			setGridError("Please fill in all date ranges.");
			setIsApplying(false);
			return;
		}
		for (const dr of dateRanges) {
			if (dr.to!.isBefore(dr.from!)) {
				setGridError(
					"End date must be after start date in each date range.",
				);
				setIsApplying(false);
				return;
			}
		}

		// Compute overall min/max across all date ranges for column generation
		const overallFrom = dateRanges.reduce<Dayjs>(
			(min, dr) => (dr.from!.isBefore(min) ? dr.from! : min),
			dateRanges[0].from!,
		);
		const overallTo = dateRanges.reduce<Dayjs>(
			(max, dr) => (dr.to!.isAfter(max) ? dr.to! : max),
			dateRanges[0].to!,
		);

		// Filter products by Principal, Storage, and Price Class
		const selectedPrincipalIds = new Set([selectedPrincipal.principal.id]);
		let filtered = placeholderProducts.filter((p) =>
			selectedPrincipalIds.has(p.principalId),
		);

		if (selectedStorage.length > 0) {
			const storageIds = new Set(selectedStorage.map((s) => s.id));
			filtered = filtered.filter((p) =>
				p.storageIds.some((sid) => storageIds.has(sid)),
			);
		}

		if (selectedPriceClasses.length > 0) {
			const pcSet = new Set(selectedPriceClasses);
			filtered = filtered.filter((p) => pcSet.has(p.priceClass));
		}

		if (filtered.length === 0) {
			setGridError(
				"No products match the selected filters. Try adjusting your criteria.",
			);
			setIsApplying(false);
			return;
		}

		// Generate month labels
		const monthLabels = generateMonthLabels(overallFrom, overallTo, frequency);
		if (monthLabels.length === 0) {
			setGridError("No months in the selected date range.");
			setIsApplying(false);
			return;
		}

		// Simulate async processing so the spinner is visible
		await new Promise((resolve) => setTimeout(resolve, 600));

		// Fill demand data using the global monthlyFactor
		const data = fillDemandData(filtered, monthLabels, monthlyFactor);

		// Build dynamic columns
		const dynamicCols: GridColDef[] = buildColumns(monthLabels);
		setColumns(dynamicCols);
		setRows(data);
		setApplied(true);
		setIsApplying(false);
	}, [
		selectedPrincipal,
		selectedStorage,
		selectedPriceClasses,
		dateRanges,
		frequency,
		monthlyFactor,
	]);

	// ─── Build Columns ────────────────────────────────────────────────────

	const buildColumns = useCallback((monthLabels: string[]): GridColDef[] => {
		const cols: GridColDef[] = [];

		// Group 1: Static product info
		cols.push({
			field: "code",
			headerName: "Code",
			width: 100,
			headerClassName: "group-static",
		});
		cols.push({
			field: "description",
			headerName: "Description",
			width: 280,
			headerClassName: "group-static",
		});
		cols.push({
			field: "currentLevel",
			headerName: "Current Level",
			width: 120,
			type: "number",
			headerClassName: "group-static",
			valueFormatter: (value?: number) =>
				value != null ? value.toLocaleString() : "",
		});
		cols.push({
			field: "inputUoM",
			headerName: "Input UoM",
			width: 100,
			headerClassName: "group-static",
		});
		cols.push({
			field: "qtyOnHand",
			headerName: "Qty on Hand",
			width: 110,
			type: "number",
			headerClassName: "group-static",
			valueFormatter: (value?: number) =>
				value != null ? value.toLocaleString() : "",
		});
		cols.push({
			field: "unreleasedSO",
			headerName: "Unreleased SO",
			width: 120,
			type: "number",
			headerClassName: "group-static",
			valueFormatter: (value?: number) =>
				value != null ? value.toLocaleString() : "",
		});
		cols.push({
			field: "incomingPO",
			headerName: "Incoming PO",
			width: 110,
			type: "number",
			headerClassName: "group-static",
			valueFormatter: (value?: number) =>
				value != null ? value.toLocaleString() : "",
		});

		// Group 2: Monthly Demand (dynamic)
		monthLabels.forEach((label) => {
			const fieldKey = `demand_${label.replace(/\s/g, "_")}`;
			cols.push({
				field: fieldKey,
				headerName: label,
				width: 100,
				type: "number",
				headerClassName: "group-demand",
				valueGetter: (_value, row) =>
					(row as ProductRow).monthlyDemand[label] ?? 0,
				valueFormatter: (value?: number) =>
					value != null ? value.toLocaleString() : "",
			});
		});

		// Group 3: Monthly Computation
		cols.push({
			field: "highestMonthlyDemand",
			headerName: "Highest Demand",
			width: 130,
			type: "number",
			headerClassName: "group-computation",
			valueFormatter: (value?: number) =>
				value != null ? value.toLocaleString() : "",
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
				value != null ? value.toLocaleString() : "",
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
				value != null ? value.toLocaleString() : "",
		});

		return cols;
	}, []);

	// ─── Grid Edit Handler ────────────────────────────────────────────────

	const processRowUpdate = useCallback(
		(newRow: GridRowModel, oldRow: GridRowModel) => {
			const updatedRow = { ...newRow } as ProductRow;

			// If monthlyFactor changed, recalculate suggestedOrder
			if (newRow.monthlyFactor !== oldRow.monthlyFactor) {
				updatedRow.suggestedOrder =
					Math.round(newRow.highestMonthlyDemand * newRow.monthlyFactor * 100) /
					100;
			}

			// If customOrder is set, clear it or keep it
			if (newRow.customOrder === "") {
				updatedRow.customOrder = null;
			}

			setRows((prev: readonly GridRowModel[]) =>
				prev.map((r: GridRowModel) =>
					(r as ProductRow).id === newRow.id ? updatedRow : r,
				),
			);

			return updatedRow;
		},
		[],
	);

	// ─── Filter Panel ─────────────────────────────────────────────────────

	const filterPanel = (
		<Paper sx={{ width: "100%", mb: 3, p: 3, borderRadius: 2 }}>
			<Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
				Purchase Requirements Filters
			</Typography>

			<Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
				{/* Left column - filters (60%) */}
				<Box sx={{ flex: "3 1 0%", minWidth: 300 }}>
					<Grid container spacing={3}>
						{/* Principal - full width */}
						<Grid size={{ xs: 12 }}>
							<FormControl fullWidth>
								<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>
									Select Principal
								</FormLabel>
								<Autocomplete
									size="small"
									options={principalOptions}
									value={selectedPrincipal}
									onChange={(_, newVal) => setSelectedPrincipal(newVal)}
									getOptionLabel={(option) => option.principal.name}
									groupBy={(option) => {
										const labels: Record<string, string> = {
											immediate: "Immediate Purchase Requirements",
											secondary: "Secondary Purchase Requirements",
											monitoring: "Monitoring",
										};
										return labels[option.category] || option.category;
									}}
									isOptionEqualToValue={(option, val) =>
										option.principal.id === val.principal.id && option.category === val.category
									}
									renderOption={(props, option) => {
										const { key, ...rest } = props;
										return (
											<li key={key} {...rest}>
												{option.principal.name}
											</li>
										);
									}}
									renderValue={(value) => {
										const chipColors: Record<string, string> = {
											immediate: "#d32f2f",
											secondary: "#ed6c02",
											monitoring: "#0288d1",
										};
										return (
											<Chip
												label={value.principal.name}
												size="small"
												sx={{
													backgroundColor: chipColors[value.category] || "#757575",
													color: "#fff",
													fontWeight: 500,
													height: 24,
													"& .MuiChip-label": { px: 1 },
												}}
											/>
										);
									}}
									renderInput={(params) => (
										<TextField
											{...params}
											placeholder="Search or select principal"
											sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
										/>
									)}
									renderGroup={(params) => {
										const groupColor: Record<string, { bg: string; text: string }> =
											{
												"Immediate Purchase Requirements": {
													bg: "#d32f2f",
													text: "#ffffff",
												},
												"Secondary Purchase Requirements": {
													bg: "#ed6c02",
													text: "#ffffff",
												},
												Monitoring: {
													bg: "#0288d1",
													text: "#ffffff",
												},
											};
										const colors = groupColor[params.group] ?? {
											bg: "var(--sidebar-bg)",
											text: "var(--sidebar-text)",
										};
										return (
											<li key={params.key}>
												<div
													style={{
														fontWeight: 600,
														fontSize: "0.75rem",
														lineHeight: "32px",
														padding: "0 16px",
														backgroundColor: colors.bg,
														color: colors.text,
														textTransform: "uppercase",
														letterSpacing: "0.05em",
													}}
												>
													{params.group}
												</div>
												<ul style={{ padding: 0 }}>{params.children}</ul>
											</li>
										);
									}}
								/>
							</FormControl>
						</Grid>
						{/* Inventory Storage - half width */}
						<Grid size={{ xs: 12, md: 6 }}>
							<FormControl fullWidth>
								<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>
									Inventory Storage
									<Tooltip title="Manage storage locations">
										<IconButton
											size="small"
											onClick={() => setStorageDialogOpen(true)}
											sx={{ ml: 0.5 }}
										>
											<SettingsIcon fontSize="small" />
										</IconButton>
									</Tooltip>
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
						{/* Price Class - half width */}
						<Grid size={{ xs: 12, md: 6 }}>
							<FormControl fullWidth>
								<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>Price Class</FormLabel>
								<Autocomplete
									multiple
									size="small"
									options={priceClasses}
									value={selectedPriceClasses}
									onChange={(_, newVal) => setSelectedPriceClasses(newVal)}
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
												{option}
											</li>
										);
									}}
									renderInput={(params) => (
										<TextField
											{...params}
											placeholder="Select price classes"
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
									onChange={(e) =>
										setFrequency(e.target.value as Frequency)
									}
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
						{/* Monthly Factor - half width */}
						<Grid size={{ xs: 12, md: 6 }}>
							<FormControl fullWidth>
								<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>
									Monthly Factor (Default)
								</FormLabel>
								<TextField
									type="number"
									size="small"
									value={monthlyFactor}
									onChange={(e) =>
										setMonthlyFactor(parseFloat(e.target.value) || 0)
									}
									slotProps={{
										htmlInput: { step: 0.1, min: 0 },
									}}
									sx={{
										"& .MuiOutlinedInput-root": { borderRadius: 2 },
									}}
								/>
							</FormControl>
						</Grid>
						{/* PO RefNbr - full width */}
						<Grid size={{ xs: 12 }}>
							<FormControl fullWidth>
								<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>
									PO RefNbr
								</FormLabel>
								<TextField
									size="small"
									value={poRefNbr}
									onChange={(e) => setPoRefNbr(e.target.value)}
									placeholder="Enter PO reference number"
									sx={{
										"& .MuiOutlinedInput-root": { borderRadius: 2 },
									}}
								/>
							</FormControl>
						</Grid>
					</Grid>
				</Box>

				{/* Right column - DateRange card (40%) */}
				<Box sx={{ flex: "2 1 0%", minWidth: 250 }}>
					<Paper sx={{ p: 2, height: 290, overflowY: "auto", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
						<FormLabel sx={{ fontWeight: 500, mb: 1, display: "block" }}>
							Date Range
						</FormLabel>
						<LocalizationProvider dateAdapter={AdapterDayjs}>
							<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
								{dateRanges.map((dr, index) => (
									<Box key={index} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
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
					</Paper>
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
						{/* Error message - own row on mobile, left side on desktop */}
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
						{/* Spacer when no error (hidden on mobile) */}
						{!gridError && (
							<Box sx={{ flex: 1, display: { xs: "none", md: "block" } }} />
						)}
						{/* Indicators + Apply on the right */}
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
								sx={{
									borderRadius: 2,
									px: 4,
								}}
							>
								Apply
							</Button>
						</Box>
					</Box>
				</Box>
			</Box>
		</Paper>
	);

	// ─── Custom Toolbar ─────────────────────────────────────────────────

	const handleExcelExport = useCallback(() => {
		const filename = poRefNbr
			? `purchase-requirements-${poRefNbr}.xlsx`
			: "purchase-requirements.xlsx";
		exportDataGridToExcel(rows as Record<string, unknown>[], columns, filename);
	}, [rows, columns, poRefNbr]);

	const CustomToolbar = useCallback(() => {
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
				<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
					Filtered Products
				</Typography>
				<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
					<ColumnsPanelTrigger
						size="small"
						startIcon={<ViewColumnIcon />}
						style={{
							minWidth: "auto",
							textTransform: "none",
							fontSize: "0.8125rem",
							fontWeight: 500,
							paddingLeft: 6,
							paddingRight: 6,
							color: theme.palette.primary.main,
						}}
					>
						Columns
					</ColumnsPanelTrigger>
					<FilterPanelTrigger
						size="small"
						startIcon={<FilterListIcon />}
						style={{
							minWidth: "auto",
							textTransform: "none",
							fontSize: "0.8125rem",
							fontWeight: 500,
							paddingLeft: 6,
							paddingRight: 6,
							color: theme.palette.primary.main,
						}}
					>
						Filters
					</FilterPanelTrigger>
					<ExportCsv
						size="small"
						startIcon={<FileDownloadIcon />}
						style={{
							minWidth: "auto",
							textTransform: "none",
							fontSize: "0.8125rem",
							fontWeight: 500,
							paddingLeft: 6,
							paddingRight: 6,
							color: theme.palette.primary.main,
						}}
					>
						CSV
					</ExportCsv>
					<ExportPrint
						size="small"
						startIcon={<PrintIcon />}
						style={{
							minWidth: "auto",
							textTransform: "none",
							fontSize: "0.8125rem",
							fontWeight: 500,
							paddingLeft: 6,
							paddingRight: 6,
							color: theme.palette.primary.main,
						}}
					>
						Print
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
							Excel
						</Button>
					</Tooltip>
				</Box>
			</Box>
		);
	}, [handleExcelExport]);

	// ─── Persist Form State ──────────────────────────────────────────────

	const persistState = useMemo(
		() => ({
			selectedPrincipal,
			selectedStorage,
			selectedPriceClasses,
			storageLocations,
			frequency,
			monthlyFactor,
			poRefNbr,
			dateRanges: serializeDateRanges(dateRanges),
		}),
		[
			selectedPrincipal,
			selectedStorage,
			selectedPriceClasses,
			storageLocations,
			frequency,
			monthlyFactor,
			poRefNbr,
			dateRanges,
		],
	);

	useEffect(() => {
		persistFormState(persistState);
	}, [persistState]);

	// ─── Render ───────────────────────────────────────────────────────────

	return (
		<>
			{/* Filter Panel */}
			{filterPanel}

			{/* Storage CRUD Dialog */}
			<StorageDialog
				open={storageDialogOpen}
				onClose={() => setStorageDialogOpen(false)}
				locations={storageLocations}
				onSave={(locs) => setStorageLocations(locs)}
			/>

			{/* Data Grid */}
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
						getRowClassName={(params) => {
							const row = params.row as ProductRow;
							const category = principalCategoryMap[row.principalId];
							return `row-principal-${category || "default"}`;
						}}
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
							"& .row-principal-immediate": {
								backgroundColor: darkMode
									? "rgba(239, 83, 80, 0.12)"
									: "#ffebee",
								"&:hover": {
									backgroundColor: darkMode
										? "rgba(239, 83, 80, 0.20)"
										: "#ffcdd2",
								},
								"&.Mui-selected": {
									backgroundColor: darkMode
										? "rgba(239, 83, 80, 0.28) !important"
										: "#ef9a9a !important",
								},
							},
							"& .row-principal-secondary": {
								backgroundColor: darkMode
									? "rgba(255, 183, 77, 0.12)"
									: "#fff3e0",
								"&:hover": {
									backgroundColor: darkMode
										? "rgba(255, 183, 77, 0.20)"
										: "#ffe0b2",
								},
								"&.Mui-selected": {
									backgroundColor: darkMode
										? "rgba(255, 183, 77, 0.28) !important"
										: "#ffcc80 !important",
								},
							},
							"& .row-principal-monitoring": {
								backgroundColor: darkMode
									? "rgba(100, 181, 246, 0.12)"
									: "#e3f2fd",
								"&:hover": {
									backgroundColor: darkMode
										? "rgba(100, 181, 246, 0.20)"
										: "#bbdefb",
								},
								"&.Mui-selected": {
									backgroundColor: darkMode
										? "rgba(100, 181, 246, 0.28) !important"
										: "#90caf9 !important",
								},
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
