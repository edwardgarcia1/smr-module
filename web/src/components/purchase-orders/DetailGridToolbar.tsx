/**
 * DetailGridToolbar — Toolbar rendered inside the PO detail DataGrid.
 * Shows PO metadata, status selector, category filter, demand toggle,
 * and export buttons.
 */
import React from "react";
import {
	Box,
	Typography,
	Button,
	IconButton,
	Tooltip,
	CircularProgress,
} from "@mui/material";
import { ColumnsPanelTrigger, FilterPanelTrigger } from "@mui/x-data-grid";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import FilterListIcon from "@mui/icons-material/FilterList";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CategoryFilter from "../requirements/CategoryFilter";
import StatusChipSelect from "./StatusChipSelect";
import {
	type PurchaseOrder,
	type PoStatus,
	capitalize,
	formatDate,
} from "../../config/purchaseOrders";
import type { CategoryColorScheme } from "../../config/requirements";

const labelSx = { display: { xs: "none", md: "inline" } };
const toolbarBtnStyle: React.CSSProperties = {
	minWidth: "auto",
	textTransform: "none",
	fontSize: "0.8125rem",
	fontWeight: 500,
	paddingLeft: 6,
	paddingRight: 6,
};

interface DetailGridToolbarProps {
	selectedPo: PurchaseOrder | null;
	detailCategories: string[];
	onDetailCategoriesChange: (cats: string[]) => void;
	getCategoryColor: (cat: string) => CategoryColorScheme;
	showDetailDemand: boolean;
	onToggleDetailDemand: () => void;
	onExcelExport: () => void;
	onPdfExport: () => void;
	onClose: () => void;
	onStatusChange: (newStatus: PoStatus) => void;
	isDetailPdfExporting: boolean;
}

const DetailGridToolbar: React.FC<DetailGridToolbarProps> = ({
	selectedPo,
	detailCategories,
	onDetailCategoriesChange,
	getCategoryColor,
	showDetailDemand,
	onToggleDetailDemand,
	onExcelExport,
	onPdfExport,
	onClose,
	onStatusChange,
	isDetailPdfExporting,
}) => (
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
					<StatusChipSelect
						value={selectedPo.status}
						onChange={onStatusChange}
						disabledOptions={["Pending", "Printed"]}
					/>
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
						onClick={onExcelExport}
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
						onClick={onPdfExport}
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
					<IconButton size="small" onClick={onClose} sx={{ ml: 0.5 }}>
						<CloseIcon fontSize="small" />
					</IconButton>
				</Tooltip>
			</Box>
		</Box>
		{selectedPo && (
			<Box sx={{ px: 2, pb: 0.5 }}>
				<Typography variant="body2" color="text.secondary">
					{capitalize(selectedPo.frequency)} ·{" "}
					{capitalize(selectedPo.demand_mode)} demand · Principal:{" "}
					{selectedPo.principal_id} · {formatDate(selectedPo.sales_from)} –{" "}
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
				onChange={onDetailCategoriesChange}
				getCategoryColor={getCategoryColor}
			/>
			<Button
				size="small"
				variant="outlined"
				startIcon={
					showDetailDemand ? <VisibilityOffIcon /> : <VisibilityIcon />
				}
				onClick={onToggleDetailDemand}
				sx={{ textTransform: "none", borderRadius: 2, ml: "auto" }}
			>
				{showDetailDemand ? "Hide" : "Show"} Monthly Demand
			</Button>
		</Box>
	</Box>
);

export default DetailGridToolbar;
