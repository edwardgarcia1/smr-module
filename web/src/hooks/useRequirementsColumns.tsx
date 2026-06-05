/**
 * useRequirementsColumns — Column builders and column group models for the
 * RequirementsPage purchasing and bundling DataGrids.
 *
 * Extracted from the monolithic useRequirements.tsx.
 */
import React from "react";
import { Chip } from "@mui/material";
import type {
	GridColDef,
	GridColumnGroupingModel,
} from "@mui/x-data-grid";
import {
	fmt2,
	fmtFixed2,
	fmt0,
	formatDate,
} from "../utils/numberFormat";
import {
	computeCategoryName,
	CATEGORY_ORDER,
} from "../config/requirements";
import type {
	Frequency,
	DemandMode,
	RequirementRow,
	BundlingRow,
	MinStockCategory,
} from "../config/requirements";
import ComponentsListCell from "../components/requirements/ComponentsListCell";

// ─── Shared column helpers (pure functions) ───────────────────────────

export function pushInventoryColumns(cols: GridColDef[]): void {
	const inventoryHeader = { headerClassName: "group-inventory" };
	for (const { field, label } of [
		{ field: "qtyAlloc", label: "Unreleased" },
		{ field: "qtyOnPO", label: "Incoming" },
		{ field: "qtyOnHand", label: "On Hand" },
		{ field: "qtyAvail", label: "Available" },
	]) {
		cols.push({
			field,
			headerName: label,
			width: 110,
			type: "number",
			...inventoryHeader,
			valueFormatter: fmt2,
		});
	}
}

export function pushDemandColumns(
	cols: GridColDef[],
	periodKeys: string[],
): void {
	periodKeys.forEach((key) => {
		const fieldKey = `pd_${key.replace(/[\s]/g, "_")}`;
		cols.push({
			field: fieldKey,
			headerName: key,
			width: 110,
			type: "number",
			headerClassName: "group-demand",
			valueGetter: (_v, row) =>
				(row as RequirementRow | BundlingRow).periodDemand[key] ?? 0,
			valueFormatter: fmt2,
		});
	});
}

// ─── Column building callbacks ───────────────────────────────────────

export function buildPurchasingCols(
	frequency: Frequency,
	demandMode: DemandMode,
	periodKeys: string[],
	df: number,
	categoriesRef: React.MutableRefObject<MinStockCategory[]>,
	displayFactorRef: React.MutableRefObject<number>,
): GridColDef[] {
	const demandLabel =
		demandMode === "highest"
			? "Highest Demand"
			: `Avg ${frequency === "monthly" ? "Monthly" : "Weekly"}`;
	const demandLabelCS =
		demandMode === "highest"
			? "Highest Demand (CS)"
			: `Avg ${frequency === "monthly" ? "Monthly" : "Weekly"} (CS)`;

	const cols: GridColDef[] = [];
	const staticHeader = { headerClassName: "group-static" };
	const priceHeader = { headerClassName: "group-price" };
	const compHeader = { headerClassName: "group-computation" };

	// Static columns
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
		description:
			"Conversion factor from Stock Unit to CS (CnvFact from INUnit)",
		valueFormatter: (value?: number) =>
			value != null
				? value.toLocaleString(undefined, {
						minimumFractionDigits: 4,
						maximumFractionDigits: 4,
					})
				: "—",
	});

	// Price columns
	cols.push({
		field: "price_ao",
		headerName: "Last Update",
		width: 150,
		...priceHeader,
		valueGetter: (_v, row) => (row as RequirementRow).price_ao,
		valueFormatter: (value?: string) => formatDate(value),
	});
	cols.push({
		field: "price_perCS",
		headerName: "Per CS",
		width: 110,
		type: "number",
		...priceHeader,
		valueGetter: (_v, row) => (row as RequirementRow).price_perCS,
		valueFormatter: fmt2,
	});
	cols.push({
		field: "price_perStkUnit",
		headerName: "Per StkUnit",
		width: 110,
		type: "number",
		...priceHeader,
		valueGetter: (_v, row) => (row as RequirementRow).price_perStkUnit,
		valueFormatter: fmt2,
	});

	// Inventory columns
	pushInventoryColumns(cols);

	// Demand columns
	pushDemandColumns(cols, periodKeys);

	// Computation columns
	cols.push({
		field: "totalDemand",
		headerName: "Total",
		width: 110,
		type: "number",
		...compHeader,
		valueGetter: (_v, row) =>
			Object.values((row as RequirementRow).periodDemand ?? {}).reduce(
				(s, v) => s + v,
				0,
			),
		valueFormatter: fmt2,
	});
	cols.push({
		field: "totalDemandCS",
		headerName: "Total (CS)",
		width: 110,
		type: "number",
		...compHeader,
		valueGetter: (_v, row) => (row as RequirementRow).totalDemandCS,
		valueFormatter: fmt2,
	});
	cols.push({
		field: "avgDemand",
		headerName: demandLabel,
		width: 150,
		type: "number",
		...compHeader,
		valueFormatter: fmt2,
	});
	cols.push({
		field: "avgDemandCS",
		headerName: demandLabelCS,
		width: 120,
		type: "number",
		...compHeader,
		description: `${
			demandMode === "highest" ? "Highest period" : "Average"
		} demand converted to cases (CS)`,
		valueFormatter: fmt2,
	});
	cols.push({
		field: "stockCoverCount",
		headerName: `Stock Cover (${
			frequency === "monthly" ? "Months" : "Weeks"
		})`,
		width: 130,
		type: "number",
		...compHeader,
		valueFormatter: fmtFixed2,
	});

	// Stock / Order columns
	const stockHeader = { headerClassName: "group-stock" };
	cols.push({
		field: "coverageThreshold",
		headerName: `Min Stock (${
			frequency === "weekly" ? "Weeks" : "Months"
		})`,
		width: 100,
		type: "number",
		editable: true,
		...stockHeader,
		renderEditCell: (params) => {
			const editDisplayValue =
				frequency === "weekly" && params.value != null
					? (Number(params.value) * df).toFixed(2)
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
								frequency === "weekly" ? rawVal / df : rawVal;
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
			return frequency === "weekly"
				? (value * df).toFixed(2)
				: value.toFixed(2);
		},
	});
	cols.push({
		field: "suggestedOrder",
		headerName: "Suggested Order",
		width: 180,
		type: "number",
		...stockHeader,
		description:
			"Stock-aware: fills up to the resolved min stock threshold (per-item coverage)",
		valueFormatter: fmt2,
	});
	cols.push({
		field: "suggestedOrderCS",
		headerName: "Suggested Order (CS)",
		width: 130,
		type: "number",
		...stockHeader,
		description: "Suggested order converted to cases (CS)",
		valueFormatter: fmt2,
	});
	cols.push({
		field: "customOrder",
		headerName: "Custom Order (CS)",
		width: 130,
		type: "number",
		editable: true,
		...stockHeader,
		valueFormatter: fmt2,
	});

	// Final Order
	const finalOrderHeader = { headerClassName: "group-final-order" };
	cols.push({
		field: "finalOrderCS",
		headerName: "Final Order (CS)",
		width: 130,
		type: "number",
		...finalOrderHeader,
		description:
			"Actual order: Custom Order (CS) when set, otherwise Suggested Order (CS)",
		valueGetter: (_v, row: RequirementRow) =>
			row.customOrder != null ? row.customOrder : row.suggestedOrderCS,
		valueFormatter: fmt2,
	});

	const periodLabel = frequency === "monthly" ? "Months" : "Weeks";
	const getFinalQty = (row: RequirementRow) =>
		row.customOrder != null ? row.customOrder : row.suggestedOrderCS;

	cols.push({
		field: "orderCover",
		headerName: `Order Cover (${periodLabel})`,
		width: 130,
		type: "number",
		...stockHeader,
		description: "Final Order (CS) ÷ Avg demand (CS)",
		valueGetter: (_v, row: RequirementRow) => {
			const finalQty = getFinalQty(row);
			if (
				row.avgDemandCS == null ||
				row.avgDemandCS === 0 ||
				finalQty == null
			)
				return null;
			return finalQty / row.avgDemandCS;
		},
		valueFormatter: fmtFixed2,
	});
	cols.push({
		field: "incomingCover",
		headerName: `Incoming Cover (${periodLabel})`,
		width: 130,
		type: "number",
		...stockHeader,
		description: "Incoming (PO) ÷ Avg demand",
		valueGetter: (_v, row: RequirementRow) => {
			if (
				row.avgDemand == null ||
				row.avgDemand === 0 ||
				row.qtyOnPO == null
			)
				return null;
			return row.qtyOnPO / row.avgDemand;
		},
		valueFormatter: fmtFixed2,
	});
	cols.push({
		field: "totalCover",
		headerName: `Total Cover (${periodLabel})`,
		width: 140,
		type: "number",
		...stockHeader,
		description: "Stock Cover + Order Cover + Incoming Cover",
		valueGetter: (_v, row: RequirementRow) => {
			const finalQty = getFinalQty(row);
			if (
				row.avgDemandCS == null ||
				row.avgDemandCS === 0 ||
				finalQty == null
			)
				return null;
			const orderCover = finalQty / row.avgDemandCS;
			const incomingCover =
				row.qtyOnPO != null && row.avgDemand != null && row.avgDemand > 0
					? row.qtyOnPO / row.avgDemand
					: 0;
			return (row.stockCoverCount ?? 0) + orderCover + incomingCover;
		},
		valueFormatter: fmtFixed2,
	});
	cols.push({
		field: "amount",
		headerName: "Amount",
		width: 130,
		type: "number",
		...stockHeader,
		description:
			"Order amount: customOrder × Price per CS, or suggestedOrderCS × Price per CS",
		valueGetter: (_v, row: RequirementRow) => {
			const qty =
				row.customOrder != null ? row.customOrder : row.suggestedOrderCS;
			const price = row.price_perCS;
			if (price == null) return null;
			return Math.round(qty * price * 100) / 100;
		},
		valueFormatter: fmt2,
	});
	cols.push({
		field: "_category",
		headerName: "Category",
		width: 130,
		valueGetter: (_v, row: RequirementRow) =>
			computeCategoryName(
				row,
				categoriesRef.current,
				displayFactorRef.current,
			),
		sortComparator: (v1: string | null, v2: string | null) => {
			const o1 = v1 ? (CATEGORY_ORDER[v1] ?? 99) : 99;
			const o2 = v2 ? (CATEGORY_ORDER[v2] ?? 99) : 99;
			return o1 - o2;
		},
	});

	return cols;
}

export function buildBundlingCols(
	frequency: Frequency,
	demandMode: DemandMode,
	periodKeys: string[],
	_displayFactor: number,
	categoriesRef: React.MutableRefObject<MinStockCategory[]>,
	displayFactorRef: React.MutableRefObject<number>,
): GridColDef[] {
	const bundlingDemandLabel =
		demandMode === "highest"
			? "Highest Demand"
			: `Avg ${frequency === "monthly" ? "Monthly" : "Weekly"} Demand`;

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
	const bundlingHeader = { headerClassName: "group-bundling" };
	cols.push({
		field: "canFulfillFromBundling",
		headerName: "Bundle?",
		width: 90,
		...bundlingHeader,
		renderCell: (params) => {
			const row = params.row as BundlingRow;
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
		...bundlingHeader,
		valueFormatter: fmt0,
	});
	cols.push({
		field: "suggestedBundles",
		headerName: "Suggested Bundles",
		width: 130,
		type: "number",
		...bundlingHeader,
		valueFormatter: fmt0,
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
			const row = params.row as BundlingRow;
			return <ComponentsListCell components={row.components ?? []} />;
		},
	});

	// Inventory columns
	pushInventoryColumns(cols);

	// Demand columns
	pushDemandColumns(cols, periodKeys);

	// Computation columns
	const compHeader = { headerClassName: "group-computation" };
	cols.push({
		field: "avgDemand",
		headerName: bundlingDemandLabel,
		width: 150,
		type: "number",
		...compHeader,
		valueFormatter: fmt2,
	});
	cols.push({
		field: "stockCoverCount",
		headerName: `Stock Cover (${
			frequency === "monthly" ? "Months" : "Weeks"
		})`,
		width: 130,
		type: "number",
		...compHeader,
		valueFormatter: fmtFixed2,
	});

	// Category
	cols.push({
		field: "_category",
		headerName: "Category",
		width: 130,
		valueGetter: (_v, row: BundlingRow) =>
			computeCategoryName(
				row,
				categoriesRef.current,
				displayFactorRef.current,
			),
		sortComparator: (v1: string | null, v2: string | null) => {
			const o1 = v1 ? (CATEGORY_ORDER[v1] ?? 99) : 99;
			const o2 = v2 ? (CATEGORY_ORDER[v2] ?? 99) : 99;
			return o1 - o2;
		},
	});

	return cols;
}

// ─── Column Grouping Models ──────────────────────────────────────────

export function buildPurchasingColumnGroupModel(
	periodKeys: string[],
	frequency: Frequency,
	selectedPriceClass: string,
): GridColumnGroupingModel {
	const demandGroupLabel = `${
		frequency === "monthly" ? "Monthly" : "Weekly"
	} Demand`;
	const computationGroupLabel = `${
		frequency === "monthly" ? "Monthly" : "Weekly"
	} Computation`;

	return [
		{
			groupId: demandGroupLabel,
			headerClassName: "group-demand",
			children: periodKeys.map((key) => ({
				field: `pd_${key.replace(/[\s]/g, "_")}`,
			})),
		},
		{
			groupId: computationGroupLabel,
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
				{ field: "finalOrderCS" },
				{ field: "orderCover" },
				{ field: "incomingCover" },
				{ field: "totalCover" },
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
		{
			groupId: `Price (${selectedPriceClass})`,
			headerClassName: "group-price",
			children: [
				{ field: "price_ao" },
				{ field: "price_perCS" },
				{ field: "price_perStkUnit" },
			],
		},
	];
}

export function buildBundlingColumnGroupModel(
	periodKeys: string[],
	frequency: Frequency,
): GridColumnGroupingModel {
	const demandGroupLabel = `${
		frequency === "monthly" ? "Monthly" : "Weekly"
	} Demand`;
	const computationGroupLabel = `${
		frequency === "monthly" ? "Monthly" : "Weekly"
	} Computation`;

	return [
		{
			groupId: demandGroupLabel,
			headerClassName: "group-demand",
			children: periodKeys.map((key) => ({
				field: `pd_${key.replace(/[\s]/g, "_")}`,
			})),
		},
		{
			groupId: computationGroupLabel,
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
	];
}
