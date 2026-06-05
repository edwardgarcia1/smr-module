import React from "react";
import {
	Box,
	TextField,
	Button,
	Autocomplete,
	Tooltip,
} from "@mui/material";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import type { GridColDef } from "@mui/x-data-grid";
import RequirementsToolbarBase from "./RequirementsToolbarBase";

interface PurchasingToolbarProps {
	apiRef: { current: { setColumnVisibilityModel: (model: Record<string, boolean>) => void } | null };
	handleExcelExport: () => void;
	darkMode: boolean;
	frequency: string;
	bulkMinStock: string;
	setBulkMinStock: (val: string) => void;
	handleBulkMinStockApply: () => void;
	priceClasses: string[];
	selectedPriceClass: string;
	setSelectedPriceClass: (val: string) => void;
	selectedCategories: string[];
	setSelectedCategories: (val: string[]) => void;
	showDemandColumns: boolean;
	setShowDemandColumns: (val: boolean) => void;
	purchasingColumns: GridColDef[];
	userColumnVisibilityModelRef: React.MutableRefObject<Record<string, boolean>>;
	onOpenSaveDialog: () => void;
}

const PurchasingToolbar: React.FC<PurchasingToolbarProps> = ({
	apiRef,
	handleExcelExport,
	darkMode,
	frequency,
	bulkMinStock,
	setBulkMinStock,
	handleBulkMinStockApply,
	priceClasses,
	selectedPriceClass,
	setSelectedPriceClass,
	selectedCategories,
	setSelectedCategories,
	showDemandColumns,
	setShowDemandColumns,
	purchasingColumns,
	userColumnVisibilityModelRef,
	onOpenSaveDialog,
}) => (
	<RequirementsToolbarBase
		title="Filtered Products"
		handleExcelExport={handleExcelExport}
		darkMode={darkMode}
		selectedCategories={selectedCategories}
		setSelectedCategories={setSelectedCategories}
		topActions={
			<Tooltip title="Save Purchase Order">
				<Button
					size="small"
					color="primary"
					startIcon={<SaveAltIcon />}
					onClick={onOpenSaveDialog}
					sx={{
						minWidth: "auto",
						textTransform: "none",
						fontSize: "0.8125rem",
						fontWeight: 500,
						px: 0.75,
					}}
				>
					<Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
						Save
					</Box>
				</Button>
			</Tooltip>
		}
		bottomControls={
			<>
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
					disableClearable
					options={priceClasses}
					value={selectedPriceClass}
					onChange={(_, newVal) => {
						if (newVal) setSelectedPriceClass(newVal);
					}}
					sx={{ width: 180 }}
					renderInput={(params) => (
						<TextField
							{...params}
							label="Price Class"
							sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
						/>
					)}
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
			</>
		}
	/>
);

export default PurchasingToolbar;
