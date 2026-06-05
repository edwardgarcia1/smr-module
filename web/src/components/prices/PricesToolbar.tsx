import React from "react";
import {
	Box,
	Typography,
	TextField,
	Button,
	IconButton,
	InputAdornment,
	Autocomplete,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import UploadIcon from "@mui/icons-material/Upload";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import type { Principal } from "../../config/prices";
import { UNIT_OPTIONS } from "../../config/prices";

interface PricesToolbarProps {
	searchInputValue: string;
	onSearchInputChange: (value: string) => void;
	handleSearch: () => void;
	handleKeyDown: (e: React.KeyboardEvent) => void;
	clearSearch: () => void;
	isSearching: boolean;
	totalCount: number;
	withoutPriceCount: number;
	unit: string | null;
	onUnitChange: (value: string | null) => void;
	onImportClick: () => void;
	onPriceClassesClick: () => void;
	principals: Principal[];
	selectedPrincipal: Principal | null;
	onPrincipalChange: (value: Principal | null) => void;
}

const PricesToolbar: React.FC<PricesToolbarProps> = ({
	searchInputValue,
	onSearchInputChange,
	handleSearch,
	handleKeyDown,
	clearSearch,
	isSearching,
	totalCount,
	withoutPriceCount,
	unit,
	onUnitChange,
	onImportClick,
	onPriceClassesClick,
	principals,
	selectedPrincipal,
	onPrincipalChange,
}) => (
	<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
		<Box
			sx={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				px: 2,
				pt: 1.5,
				pb: 1.5,
			}}
		>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
				<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
					Prices
				</Typography>
				<Typography variant="caption" sx={{ color: "text.secondary" }}>
					{totalCount} records
					{withoutPriceCount > 0 && (
						<Box
							component="span"
							sx={{ ml: 1, color: "warning.main", fontWeight: 600 }}
						>
							({withoutPriceCount} without price)
						</Box>
					)}
				</Typography>
			</Box>
			<Box sx={{ display: "flex", gap: { xs: 0.5, md: 1 } }}>
				<Button
					variant="outlined"
					size="small"
					startIcon={<AddIcon />}
					onClick={onPriceClassesClick}
					title="Price Classes"
					sx={{ whiteSpace: "nowrap", minWidth: { xs: "auto", md: 100 } }}
				>
					<Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
						Price Classes
					</Box>
				</Button>
				<Button
					variant="outlined"
					size="small"
					startIcon={<UploadIcon />}
					onClick={onImportClick}
					title="Import"
					sx={{ whiteSpace: "nowrap", minWidth: { xs: "auto", md: 100 } }}
				>
					<Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
						Import
					</Box>
				</Button>
			</Box>
		</Box>
		<Box
			sx={{
				display: "flex",
				alignItems: "center",
				gap: 1,
				flexWrap: "wrap",
				px: 2,
				pb: 1.5,
				pt: 0.5,
			}}
		>
			<TextField
				size="small"
				placeholder="Search inventory ID or description..."
				value={searchInputValue}
				onChange={(e) => onSearchInputChange(e.target.value)}
				onKeyDown={handleKeyDown}
				fullWidth
				slotProps={{
					input: {
						endAdornment: (
							<InputAdornment position="end">
								<IconButton
									size="small"
									onClick={clearSearch}
									aria-label="clear search"
									sx={{ mr: 0.25 }}
								>
									<CloseIcon fontSize="small" />
								</IconButton>
								<IconButton
									size="small"
									onClick={handleSearch}
									aria-label="search"
									disabled={isSearching}
								>
									<SearchIcon />
								</IconButton>
							</InputAdornment>
						),
					},
				}}
				sx={{
					"& .MuiOutlinedInput-root": { borderRadius: 2, height: 36 },
					"& .MuiInputBase-input": { paddingY: 0 },
					minWidth: { xs: 0, md: 220 },
				}}
			/>
			<Autocomplete
				size="small"
				options={UNIT_OPTIONS}
				value={unit}
				onChange={(_, newVal) => onUnitChange(newVal)}
				renderInput={(params) => (
					<TextField {...params} placeholder="Unit" sx={{ minWidth: 90 }} />
				)}
				sx={{ minWidth: 90 }}
			/>
			<Autocomplete
				size="small"
				options={principals}
				value={selectedPrincipal}
				onChange={(_, newVal) => onPrincipalChange(newVal)}
				getOptionLabel={(option) => `${option.ClassID} — ${option.Descr}`}
				isOptionEqualToValue={(option, val) => option.ClassID === val.ClassID}
				renderInput={(params) => (
					<TextField
						{...params}
						placeholder="Principal (Class ID)"
						sx={{ minWidth: 220 }}
					/>
				)}
				sx={{ minWidth: 220 }}
			/>
		</Box>
	</Box>
);

export default PricesToolbar;
