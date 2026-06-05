import React from "react";
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
	Alert,
	Checkbox,
	CircularProgress,
	ToggleButtonGroup,
	ToggleButton,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import type { Mode, Frequency, DemandMode, DemandSource, Principal, StorageLocation } from "../../config/requirements";
import type { DateRangeItem } from "../../config/requirements";

interface FilterPanelProps {
	mode: Mode;
	onModeChange: (mode: Mode) => void;
	principals: Principal[];
	selectedPrincipal: Principal | null;
	onPrincipalChange: (principal: Principal | null) => void;
	storageLocations: StorageLocation[];
	selectedStorage: StorageLocation[];
	onStorageChange: (locations: StorageLocation[]) => void;
	frequency: Frequency;
	onFrequencyChange: (freq: Frequency) => void;
	demandMode: DemandMode;
	onDemandModeChange: (mode: DemandMode) => void;
	demandSource: DemandSource;
	onDemandSourceChange: (source: DemandSource) => void;
	dateRange: DateRangeItem;
	onDateRangeChange: (field: "from" | "to", value: dayjs.Dayjs | null) => void;
	monthlyValidDays: Record<string, number>;
	monthlyKeys: string[];
	onMonthlyValidDayChange: (monthKey: string, value: number) => void;
	gridError: string | null;
	isApplying: boolean;
	applied: boolean;
	onApply: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
	mode,
	onModeChange,
	principals,
	selectedPrincipal,
	onPrincipalChange,
	storageLocations,
	selectedStorage,
	onStorageChange,
	frequency,
	onFrequencyChange,
	demandMode,
	onDemandModeChange,
	demandSource,
	onDemandSourceChange,
	dateRange,
	onDateRangeChange,
	monthlyValidDays,
	monthlyKeys,
	onMonthlyValidDayChange,
	gridError,
	isApplying,
	applied,
	onApply,
}) => {
	return (
		<Paper sx={{ width: "100%", mb: 3, p: 3, borderRadius: 2 }}>
			<Box
				sx={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					mb: 2,
				}}
			>
				<Typography variant="h6" sx={{ fontWeight: 600 }}>
					{mode === "purchasing"
						? "Purchase Requirements Filters"
						: "Bundling Requirements Filters"}
				</Typography>
				<ToggleButtonGroup
					value={mode}
					exclusive
					onChange={(_, newMode) => {
						if (newMode !== null) onModeChange(newMode);
					}}
					size="small"
					color="primary"
				>
					<ToggleButton
						value="purchasing"
						sx={{ textTransform: "none", fontWeight: 600, px: 2 }}
					>
						Purchasing
					</ToggleButton>
					<ToggleButton
						value="bundling"
						sx={{ textTransform: "none", fontWeight: 600, px: 2 }}
					>
						Bundling
					</ToggleButton>
				</ToggleButtonGroup>
			</Box>

			<Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
				<Box sx={{ flex: "1 1 100%" }}>
					<Grid container spacing={3}>
						{/* Row 1: Principal | Storage */}
						<Grid size={{ xs: 12, md: 6 }}>
							<FormControl fullWidth>
								<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>
									Principal
								</FormLabel>
								<Autocomplete
									size="small"
									options={principals}
									value={selectedPrincipal}
									onChange={(_, newVal) => onPrincipalChange(newVal)}
									getOptionLabel={(option) => `${option.ClassID} — ${option.Descr}`}
									isOptionEqualToValue={(option, val) =>
										option.ClassID === val.ClassID
									}
									renderInput={(params) => (
										<TextField
											{...params}
											placeholder="Search or select principal"
											sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
										/>
									)}
								/>
							</FormControl>
						</Grid>
						<Grid size={{ xs: 12, md: 6 }}>
							<FormControl fullWidth>
								<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>
									Inventory Storage
								</FormLabel>
								<Autocomplete
									multiple
									size="small"
									options={storageLocations}
									value={selectedStorage}
									onChange={(_, newVal) => onStorageChange(newVal)}
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

						{/* Row 2: Date Range | Demand Mode | Demand Source */}
						<Grid size={{ xs: 12, md: 6 }}>
							<FormControl fullWidth>
								<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>
									Date Range
								</FormLabel>
								<LocalizationProvider dateAdapter={AdapterDayjs}>
									<Box sx={{ display: "flex", gap: 1 }}>
										<DatePicker
											label="From"
											views={["month", "year"]}
											value={dateRange.from}
											onChange={(v) => onDateRangeChange("from", v)}
											slotProps={{
												textField: {
													size: "small",
													fullWidth: true,
													sx: {
														"& .MuiOutlinedInput-root": { borderRadius: 2 },
													},
												},
											}}
											sx={{ flex: 1 }}
										/>
										<DatePicker
											label="To"
											views={["month", "year"]}
											value={dateRange.to}
											onChange={(v) => onDateRangeChange("to", v)}
											slotProps={{
												textField: {
													size: "small",
													fullWidth: true,
													sx: {
														"& .MuiOutlinedInput-root": { borderRadius: 2 },
													},
												},
											}}
											sx={{ flex: 1 }}
										/>
									</Box>
								</LocalizationProvider>
							</FormControl>
						</Grid>
						<Grid size={{ xs: 6, md: 3 }}>
							<FormControl>
								<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>
									Demand Mode
								</FormLabel>
								<ToggleButtonGroup
									value={demandMode}
									exclusive
									onChange={(_, newMode) => {
										if (newMode !== null) onDemandModeChange(newMode);
									}}
									size="small"
									color="primary"
								>
									<ToggleButton
										value="average"
										sx={{ textTransform: "none", fontWeight: 600, px: 1.5, fontSize: "0.75rem" }}
									>
										{frequency === "monthly" ? "Avg Monthly" : "Avg Weekly"}
									</ToggleButton>
									<ToggleButton
										value="highest"
										sx={{ textTransform: "none", fontWeight: 600, px: 1.5, fontSize: "0.75rem" }}
									>
										Highest
									</ToggleButton>
								</ToggleButtonGroup>
							</FormControl>
						</Grid>
						<Grid size={{ xs: 6, md: 3 }}>
							<FormControl>
								<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>
									Demand Source
								</FormLabel>
								<ToggleButtonGroup
									value={demandSource}
									exclusive
									onChange={(_, newSource) => {
										if (newSource !== null) onDemandSourceChange(newSource);
									}}
									size="small"
									color="primary"
								>
									<ToggleButton
										value="shipped"
										sx={{ textTransform: "none", fontWeight: 600, px: 1.5, fontSize: "0.75rem" }}
									>
										Shipped
									</ToggleButton>
									<ToggleButton
										value="ordered"
										sx={{ textTransform: "none", fontWeight: 600, px: 1.5, fontSize: "0.75rem" }}
									>
										Ordered
									</ToggleButton>
								</ToggleButtonGroup>
							</FormControl>
						</Grid>

						{/* Row 3: Frequency */}
						<Grid size={{ xs: 12 }}>
							<FormControl>
								<FormLabel sx={{ fontWeight: 500, mb: 0.5 }}>
									Frequency
								</FormLabel>
								<RadioGroup
									row
									value={frequency}
									onChange={(e) => onFrequencyChange(e.target.value as Frequency)}
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
					</Grid>

					{/* Weekly valid days */}
					{frequency === "weekly" && monthlyKeys.length > 0 && (
						<Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mt: 2 }}>
							{monthlyKeys.map((mk) => (
								<TextField
									key={mk}
									size="small"
									type="number"
									label={dayjs(mk + "-01").format("MMM")}
									value={monthlyValidDays[mk]}
									onChange={(e) => {
										const v = parseInt(e.target.value, 10);
										if (!isNaN(v) && v > 0) {
											onMonthlyValidDayChange(mk, v);
										}
									}}
									slotProps={{ htmlInput: { min: 1, max: 31 } }}
									sx={{
										width: 86,
										"& .MuiOutlinedInput-root": { borderRadius: 2 },
									}}
								/>
							))}
						</Box>
					)}
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
						{!gridError && (
							<Box sx={{ flex: 1, display: { xs: "none", md: "block" } }} />
						)}
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
								onClick={onApply}
								size="large"
								disabled={isApplying}
								sx={{ borderRadius: 2, px: 4 }}
							>
								Apply
							</Button>
						</Box>
					</Box>
				</Box>
			</Box>
		</Paper>
	);
};

export default FilterPanel;
