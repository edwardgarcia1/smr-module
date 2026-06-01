import React from "react";
import {
	Box,
	Typography,
	Button,
	Tooltip,
	useTheme,
} from "@mui/material";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import FilterListIcon from "@mui/icons-material/FilterList";
import TableChartIcon from "@mui/icons-material/TableChart";
import { ColumnsPanelTrigger, FilterPanelTrigger } from "@mui/x-data-grid";
import CategoryFilter from "./CategoryFilter";
import { getCategoryColors, type CategoryColorScheme } from "../../config/requirements";

interface BundlingToolbarProps {
	handleExcelExport: () => void;
	darkMode: boolean;
	selectedCategories: string[];
	setSelectedCategories: (val: string[]) => void;
}

const BundlingToolbar: React.FC<BundlingToolbarProps> = ({
	handleExcelExport,
	darkMode,
	selectedCategories,
	setSelectedCategories,
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
					Promo Products — Bundling Analysis
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
				<CategoryFilter
					selectedCategories={selectedCategories}
					onChange={setSelectedCategories}
					getCategoryColor={getCategoryColor}
				/>
			</Box>
		</Box>
	);
};

export default BundlingToolbar;
