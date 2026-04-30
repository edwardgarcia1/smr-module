import React, { useState, useCallback, useMemo } from "react";
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
} from "@mui/material";
import { useThemeMode } from "../providers/AppProvider";
import {
	DataGrid,
	GridToolbarColumnsButton,
	GridToolbarFilterButton,
	GridToolbarDensitySelector,
	GridToolbarExport,
} from "@mui/x-data-grid";
import type { GridColDef, GridRowModel, GridRowsProp } from "@mui/x-data-grid";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import type { Dayjs } from "dayjs";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SettingsIcon from "@mui/icons-material/Settings";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import TableChartIcon from "@mui/icons-material/TableChart";
import { exportDataGridToExcel } from "../utils/exportToExcel";

// ─── Types ───────────────────────────────────────────────────────────────────

type Frequency = "weekly" | "monthly";

interface Principal {
	id: number;
	name: string;
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
	// Immediate Purchase
	{ id: 1, name: "ZESTO CORPORATION", category: "immediate" },
	{ id: 2, name: "PRIME GLOBAL CORPORATION", category: "immediate" },
	// Secondary Purchase
	{ id: 3, name: "ZUELLIG PHARMA CORPORATION", category: "secondary" },
	{ id: 4, name: "MULTIRICH FOODS CORPORATION", category: "secondary" },
	// Monitoring
	{ id: 5, name: "W.L. FOOD PRODUCTS", category: "monitoring" },
	{ id: 6, name: "JIA2 CORPORATION", category: "monitoring" },
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
	const [selectedPrincipal, setSelectedPrincipal] = useState<Principal[]>([]);
	const principalCategoryMap = useMemo(() => {
		const map: Record<number, string> = {};
		placeholderPrincipals.forEach((p) => {
			map[p.id] = p.category;
		});
		return map;
	}, []);

	// Filters
	const [storageLocations, setStorageLocations] = useState<StorageLocation[]>(
		defaultStorageLocations,
	);
	const [selectedStorage, setSelectedStorage] = useState<StorageLocation[]>([]);
	const priceClasses = ["A", "B", "C"];
	const [selectedPriceClasses, setSelectedPriceClasses] = useState<string[]>(
		[],
	);
	const [dateFrom, setDateFrom] = useState<Dayjs | null>(null);
	const [dateTo, setDateTo] = useState<Dayjs | null>(null);
	const [storageDialogOpen, setStorageDialogOpen] = useState(false);

	// Computation
	const [frequency, setFrequency] = useState<Frequency>("monthly");
	const [monthlyFactor, setMonthlyFactor] = useState(1.5);
	const [poRefNbr, setPoRefNbr] = useState("");

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

		if (selectedPrincipal.length === 0) {
			setGridError("Please select a Principal.");
			setIsApplying(false);
			return;
		}
		if (!dateFrom || !dateTo) {
			setGridError("Please select a date range.");
			setIsApplying(false);
			return;
		}
		if (dateTo.isBefore(dateFrom)) {
			setGridError("End date must be after start date.");
			setIsApplying(false);
			return;
		}

		// Filter products by Principal, Storage, and Price Class
		const selectedPrincipalIds = new Set(selectedPrincipal.map((p) => p.id));
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
		const monthLabels = generateMonthLabels(dateFrom, dateTo, frequency);
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
		dateFrom,
		dateTo,
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

			<Grid container spacing={3}>
				<Grid size={{ xs: 12, md: 6 }}>
					<FormControl fullWidth>
						<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>
							Select Principal
						</FormLabel>
						<Autocomplete
							multiple
							size="small"
							options={placeholderPrincipals}
							value={selectedPrincipal}
							onChange={(_, newVal) => setSelectedPrincipal(newVal)}
							getOptionLabel={(option) => option.name}
							groupBy={(option) => {
								const labels: Record<string, string> = {
									immediate: "Immediate Purchase Requirements",
									secondary: "Secondary Purchase Requirements",
									monitoring: "Monitoring",
								};
								return labels[option.category] || option.category;
							}}
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
							renderValue={(value, getItemProps) => {
								const principals = value as Principal[];
								return (
									<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
										{principals.map((principal, index) => {
											const tagProps = getItemProps({ index });
											const { key, ...chipProps } = tagProps;
											const chipColors: Record<string, string> = {
												immediate: "#d32f2f",
												secondary: "#ed6c02",
												monitoring: "#0288d1",
											};
											return (
												<Chip
													key={key}
													label={principal.name}
													size="small"
													{...chipProps}
													sx={{
														backgroundColor:
															chipColors[principal.category] || "#757575",
														color: "#fff",
														fontWeight: 500,
													}}
												/>
											);
										})}
									</Box>
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

				{/* Filters */}
				<Grid size={{ xs: 12 }} />

				<Grid size={{ xs: 12, md: 4 }}>
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

				{/* Price Class */}
				<Grid size={{ xs: 12, md: 4 }}>
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

				{/* Date Range */}
				<Grid size={{ xs: 12, md: 4 }}>
					<FormLabel sx={{ fontWeight: 500, mb: 0.5, display: "block" }}>
						Date Range
					</FormLabel>
					<Box sx={{ display: "flex", gap: 1 }}>
						<LocalizationProvider dateAdapter={AdapterDayjs}>
							<DatePicker
								label="From"
								value={dateFrom}
								onChange={(newVal) => setDateFrom(newVal)}
								slotProps={{
									textField: {
										size: "small",
										fullWidth: true,
										sx: { "& .MuiOutlinedInput-root": { borderRadius: 2 } },
									},
								}}
							/>
							<DatePicker
								label="To"
								value={dateTo}
								onChange={(newVal) => setDateTo(newVal)}
								slotProps={{
									textField: {
										size: "small",
										fullWidth: true,
										sx: { "& .MuiOutlinedInput-root": { borderRadius: 2 } },
									},
								}}
							/>
						</LocalizationProvider>
					</Box>
				</Grid>

				{/* Computation Options */}
				<Grid size={{ xs: 12 }} />

				{/* Frequency */}
				<Grid size={{ xs: 12, md: 4 }}>
					<FormControl>
						<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>Frequency</FormLabel>
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

				{/* 3.2 Monthly Factor */}
				<Grid size={{ xs: 12, md: 4 }}>
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
							sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
						/>
					</FormControl>
				</Grid>

				{/* PO RefNbr Input */}
				<Grid size={{ xs: 12, md: 4 }}>
					<FormControl fullWidth>
						<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>
							PO RefNbr
						</FormLabel>
						<TextField
							size="small"
							value={poRefNbr}
							onChange={(e) => setPoRefNbr(e.target.value)}
							placeholder="Enter PO reference number"
							sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
						/>
					</FormControl>
				</Grid>

				{/* Apply Button */}
				<Grid size={{ xs: 12 }}>
					<Box
						sx={{
							display: "flex",
							flexDirection: { xs: "column", md: "row" },
							alignItems: { xs: "flex-end", md: "center" },
							gap: 1.5,
							mt: 1,
						}}
					>
						{/* Error message — own row on mobile, left side on desktop */}
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
							{isApplying && (
								<CircularProgress size={22} thickness={2.5} />
							)}
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
				</Grid>
			</Grid>
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
					<GridToolbarColumnsButton />
					<GridToolbarFilterButton />
					<GridToolbarDensitySelector />
					<GridToolbarExport />
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
