import React from "react";
import {
	Box,
	Typography,
	TextField,
	Button,
	Autocomplete,
	Tooltip,
	CircularProgress,
	useTheme,
} from "@mui/material";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import FilterListIcon from "@mui/icons-material/FilterList";
import TableChartIcon from "@mui/icons-material/TableChart";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { ColumnsPanelTrigger, FilterPanelTrigger } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import CategoryFilter from "./CategoryFilter";
import {
	getCategoryColors,
	type CategoryColorScheme,
} from "../../config/requirements";

interface PurchasingToolbarProps {
	apiRef: { current: { setColumnVisibilityModel: (model: Record<string, boolean>) => void } | null };
	handleExcelExport: () => void;
	onOpenPdfDialog: () => void;
	isPdfExporting: boolean;
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
}

const PurchasingToolbar: React.FC<PurchasingToolbarProps> = ({
	apiRef,
	handleExcelExport,
	onOpenPdfDialog,
	isPdfExporting,
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
}) => {
	const theme = useTheme();
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

	const categoryColors = React.useMemo(() => getCategoryColors(darkMode), [darkMode]);
	const getCategoryColor = (cat: string): CategoryColorScheme =>
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
					<Tooltip title="Export to PO PDF">
						<Button
							size="small"
							color="primary"
							startIcon={
								isPdfExporting ? (
									<CircularProgress size={14} thickness={2.5} />
								) : (
									<PictureAsPdfIcon />
								)
							}
							onClick={onOpenPdfDialog}
							disabled={isPdfExporting}
							sx={{
								minWidth: "auto",
								textTransform: "none",
								fontSize: "0.8125rem",
								fontWeight: 500,
								px: 0.75,
							}}
						>
							<Box component="span" sx={labelSx}>
								{isPdfExporting ? "Exporting..." : "PO PDF"}
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
				<CategoryFilter
					selectedCategories={selectedCategories}
					onChange={setSelectedCategories}
					getCategoryColor={getCategoryColor}
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
			</Box>
		</Box>
	);
};

export default PurchasingToolbar;
