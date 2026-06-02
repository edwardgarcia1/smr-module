/**
 * Requirements Page — Purchasing & Bundling Analysis
 *
 * Architecture:
 *   - State & business logic:  useRequirements hook (hooks/useRequirements.tsx)
 *   - Types & constants:       config/requirements.ts
 *   - Number formatting:       utils/numberFormat.ts
 *   - Sub-components:          components/requirements/
 *
 * Previously a 3004-line monolithic file. Refactored for DRY, SoC, modularity.
 * Each concern now lives in its own module with a single responsibility.
 */
import React, { useCallback } from "react";
import { Paper } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useRequirements } from "../hooks/useRequirements";
import FilterPanel from "../components/requirements/FilterPanel";
import PurchasingToolbar from "../components/requirements/PurchasingToolbar";
import BundlingToolbar from "../components/requirements/BundlingToolbar";
import PoPdfExportDialog from "../components/requirements/PoPdfExportDialog";
import SavePoDialog from "../components/requirements/SavePoDialog";
import {
	purchasingGroupSelectors,
	bundlingGroupSelectors,
	buildBaseGridSx,
} from "../components/requirements/gridStyles";

const REQUIREMENTS_PAGE_SIZE_OPTIONS = [10, 20, 50];

// ─── Shared DataGrid paper wrapper ────────────────────────────────────────────

const GridPaper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<Paper
		sx={{ width: "100%", borderRadius: 2, overflow: "hidden", height: "calc(100dvh - 100px)" }}
	>
		{children}
	</Paper>
);

// ─── Page Component ───────────────────────────────────────────────────────────

const RequirementsPage: React.FC = () => {
	const {
		// Mode
		mode, setMode,
		// Theme
		darkMode, groupColors,
		// Filters
		principals, selectedPrincipal, setSelectedPrincipal,
		storageLocations, selectedStorage, setSelectedStorage,
		frequency, setFrequency,
		demandMode, setDemandMode,
		dateRange, setDateRange,
		monthlyValidDays, monthlyKeys, handleMonthlyValidDayChange,
		// Grid data
		applied, isApplying, gridError, setGridError,
		purchasingColumns, bundlingColumns,
		filteredPurchasingRows, filteredBundlingRows,
		// Handlers
		handleApply, handleBulkMinStockApply, processRowUpdate, getRowClassName,
		handleExcelExport, handlePdfExport,
		// Dialog
		pdfDialogOpen, openPdfDialog, closePdfDialog, logoOptions,
		// Toolbar state
		bulkMinStock, setBulkMinStock,
		selectedPriceClass, setSelectedPriceClass,
		poReference,
		showDemandColumns, setShowDemandColumns,
		isPdfExporting,
		priceClasses, selectedCategories, setSelectedCategories,
		// Save PO
		savePoDialogOpen, openSavePoDialog, closeSavePoDialog,
		isSavingPo, handleSavePurchaseOrder,
		// Refs
		apiRef, resultsAnchorRef, userColumnVisibilityModelRef,
		// Column models
		purchasingColumnGroupModel, bundlingColumnGroupModel,
	} = useRequirements();

	// Track column visibility model changes from user interaction
	const onColumnVisibilityModelChange = useCallback(
		(model: Record<string, boolean>) => {
			userColumnVisibilityModelRef.current = model;
		},
		[userColumnVisibilityModelRef],
	);

	// ─── Render ───────────────────────────────────────────────────────
	return (
		<>
			<FilterPanel
				mode={mode}
				onModeChange={setMode}
				principals={principals}
				selectedPrincipal={selectedPrincipal}
				onPrincipalChange={setSelectedPrincipal}
				storageLocations={storageLocations}
				selectedStorage={selectedStorage}
				onStorageChange={setSelectedStorage}
				frequency={frequency}
				onFrequencyChange={setFrequency}
				demandMode={demandMode}
				onDemandModeChange={setDemandMode}
				dateRange={dateRange}
				onDateRangeChange={(field, value) =>
					setDateRange((prev) => ({ ...prev, [field]: value }))
				}
				monthlyValidDays={monthlyValidDays}
				monthlyKeys={monthlyKeys}
				onMonthlyValidDayChange={handleMonthlyValidDayChange}
				gridError={gridError}
				isApplying={isApplying}
				applied={applied}
				onApply={handleApply}
			/>

			{/* ── Purchasing DataGrid ──────────────────────────────── */}
			{applied && mode === "purchasing" && purchasingColumns.length > 0 && (
				<GridPaper>
					<DataGrid
						apiRef={apiRef}
						rows={filteredPurchasingRows}
						columns={purchasingColumns}
						columnGroupingModel={purchasingColumnGroupModel}
						columnGroupHeaderHeight={36}
						onColumnVisibilityModelChange={onColumnVisibilityModelChange}
						getRowClassName={getRowClassName}
						editMode="row"
						processRowUpdate={processRowUpdate}
						onProcessRowUpdateError={(err) => {
							const msg = err instanceof Error ? err.message : "Failed to save min stock for item.";
							console.error("Row update error:", msg);
							setGridError(msg);
						}}
						getRowHeight={() => 42}
						showToolbar
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						slots={{ toolbar: PurchasingToolbar as React.ComponentType<any> }}
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					slotProps={{ toolbar: { apiRef, handleExcelExport, onOpenPdfDialog: openPdfDialog, isPdfExporting, darkMode, frequency, bulkMinStock, setBulkMinStock, handleBulkMinStockApply, priceClasses, selectedPriceClass, setSelectedPriceClass, selectedCategories, setSelectedCategories, showDemandColumns, setShowDemandColumns, purchasingColumns, userColumnVisibilityModelRef, onOpenSaveDialog: openSavePoDialog } as any, pagination: { labelRowsPerPage: "Rows:" } }}
						initialState={{
							pagination: { paginationModel: { pageSize: 20 } },
							sorting: { sortModel: [{ field: "_category", sort: "asc" }] },
						}}
						pageSizeOptions={REQUIREMENTS_PAGE_SIZE_OPTIONS}
						checkboxSelection
						disableRowSelectionOnClick
						sx={buildBaseGridSx(darkMode, groupColors, purchasingGroupSelectors(groupColors))}
					/>
				</GridPaper>
			)}

			{/* ── Bundling DataGrid ────────────────────────────────── */}
			{applied && mode === "bundling" && bundlingColumns.length > 0 && (
				<GridPaper>
					<DataGrid
						rows={filteredBundlingRows}
						columns={bundlingColumns}
						columnGroupingModel={bundlingColumnGroupModel}
						columnGroupHeaderHeight={36}
						getRowClassName={getRowClassName}
						getRowHeight={() => 42}
						showToolbar
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						slots={{ toolbar: BundlingToolbar as React.ComponentType<any> }}
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						slotProps={{ toolbar: { handleExcelExport, darkMode, selectedCategories, setSelectedCategories } as any, pagination: { labelRowsPerPage: "Rows:" } }}
						initialState={{
							pagination: { paginationModel: { pageSize: 20 } },
							sorting: { sortModel: [{ field: "_category", sort: "asc" }] },
						}}
						pageSizeOptions={REQUIREMENTS_PAGE_SIZE_OPTIONS}
						checkboxSelection
						disableRowSelectionOnClick
						sx={buildBaseGridSx(darkMode, groupColors, bundlingGroupSelectors(groupColors))}
					/>
				</GridPaper>
			)}

			{/* ── Save PO Dialog ─────────────────────────────────── */}
			<SavePoDialog
				open={savePoDialogOpen}
				onClose={closeSavePoDialog}
				onSave={handleSavePurchaseOrder}
				isSaving={isSavingPo}
			/>

			{/* ── PO PDF Export Dialog ─────────────────────────────── */}
			{applied && mode === "purchasing" && (
				<PoPdfExportDialog
					key={`pdf-dialog-${pdfDialogOpen}`}
					open={pdfDialogOpen}
					onClose={closePdfDialog}
					onExport={handlePdfExport}
					initialValues={{ poReference }}
					logoOptions={logoOptions}
					isExporting={isPdfExporting}
				/>
			)}

			{/* Scroll anchor for auto-scroll on apply */}
			<div ref={resultsAnchorRef} />
		</>
	);
};

export default RequirementsPage;
