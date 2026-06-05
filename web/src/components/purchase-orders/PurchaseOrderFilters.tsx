/**
 * PurchaseOrderFilters — Search box, principal/site/demand-mode/frequency/status
 * autocomplete filters for the purchase orders list.
 */
import React from "react";
import {
	Box,
	TextField,
	FormControl,
	Autocomplete,
	Checkbox,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import {
	PO_STATUSES,
	capitalize,
	type PoStatus,
} from "../../config/purchaseOrders";
import { DEMAND_MODES, FREQUENCIES } from "../../config/requirements";
import type { Principal } from "../../config/requirements";

interface PurchaseOrderFiltersProps {
	searchRef: string;
	onSearchChange: (val: string) => void;
	principals: Principal[];
	filterPrincipals: Principal[];
	onFilterPrincipalsChange: (val: Principal[]) => void;
	siteFilterOptions: { id: string; name: string }[];
	filterSites: { id: string; name: string }[];
	onFilterSitesChange: (val: { id: string; name: string }[]) => void;
	filterDemandModes: string[];
	onFilterDemandModesChange: (val: string[]) => void;
	filterFrequencies: string[];
	onFilterFrequenciesChange: (val: string[]) => void;
	filterStatuses: PoStatus[];
	onFilterStatusesChange: (val: PoStatus[]) => void;
}

function renderMultiCheckbox<T>(
	props: React.HTMLAttributes<HTMLLIElement>,
	option: T,
	{ selected }: { selected: boolean },
	getLabel: (opt: T) => string,
) {
	const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key?: string };
	return (
		<li key={key} {...rest}>
			<Checkbox
				icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
				checkedIcon={<CheckBoxIcon fontSize="small" />}
				checked={selected}
			/>
			{getLabel(option)}
		</li>
	);
}

const inputSx = {
	"& .MuiOutlinedInput-root": { borderRadius: 2 },
};

const PurchaseOrderFilters: React.FC<PurchaseOrderFiltersProps> = ({
	searchRef,
	onSearchChange,
	principals,
	filterPrincipals,
	onFilterPrincipalsChange,
	siteFilterOptions,
	filterSites,
	onFilterSitesChange,
	filterDemandModes,
	onFilterDemandModesChange,
	filterFrequencies,
	onFilterFrequenciesChange,
	filterStatuses,
	onFilterStatusesChange,
}) => (
	<Box
		sx={{
			display: "flex",
			flexWrap: "wrap",
			gap: 2,
			px: 2,
			pt: 2,
			pb: 1,
			alignItems: "center",
		}}
	>
		<TextField
			size="small"
			placeholder="Search ref nbr…"
			value={searchRef}
			onChange={(e) => onSearchChange(e.target.value)}
			slotProps={{
				input: {
					startAdornment: (
						<SearchIcon
							sx={{ mr: 0.5, color: "text.secondary", fontSize: 20 }}
						/>
					),
				},
			}}
			sx={{ width: 220, ...inputSx }}
		/>
		{/* Principal filter */}
		<FormControl sx={{ minWidth: 220 }}>
			<Autocomplete
				multiple
				size="small"
				options={principals}
				value={filterPrincipals}
				onChange={(_, newVal) => onFilterPrincipalsChange(newVal)}
				getOptionLabel={(option) => `${option.ClassID} — ${option.Descr}`}
				isOptionEqualToValue={(option, val) => option.ClassID === val.ClassID}
				disableCloseOnSelect
				renderOption={(props, option, state) =>
					renderMultiCheckbox(props, option, state, (o) => `${o.ClassID} — ${o.Descr}`)
				}
				renderInput={(params) => (
					<TextField
						{...params}
						label="Principal"
						placeholder="Select principals"
						sx={inputSx}
					/>
				)}
			/>
		</FormControl>
		{/* Site filter */}
		<FormControl sx={{ minWidth: 220 }}>
			<Autocomplete
				multiple
				size="small"
				options={siteFilterOptions}
				value={filterSites}
				onChange={(_, newVal) => onFilterSitesChange(newVal)}
				getOptionLabel={(option) => option.name}
				isOptionEqualToValue={(option, val) => option.id === val.id}
				disableCloseOnSelect
				renderOption={(props, option, state) =>
					renderMultiCheckbox(props, option, state, (o) => o.name)
				}
				renderInput={(params) => (
					<TextField
						{...params}
						label="Site"
						placeholder="Select sites"
						sx={inputSx}
					/>
				)}
			/>
		</FormControl>
		{/* Demand mode filter */}
		<FormControl sx={{ minWidth: 200 }}>
			<Autocomplete
				multiple
				size="small"
				options={DEMAND_MODES}
				value={filterDemandModes}
				onChange={(_, newVal) => onFilterDemandModesChange(newVal)}
				disableCloseOnSelect
				getOptionLabel={(option) => capitalize(option)}
				renderOption={(props, option, state) =>
					renderMultiCheckbox(props, option, state, (o) => capitalize(o))
				}
				renderInput={(params) => (
					<TextField
						{...params}
						label="Demand Mode"
						placeholder="Select modes"
						sx={inputSx}
					/>
				)}
			/>
		</FormControl>
		{/* Frequency filter */}
		<FormControl sx={{ minWidth: 200 }}>
			<Autocomplete
				multiple
				size="small"
				options={FREQUENCIES}
				value={filterFrequencies}
				onChange={(_, newVal) => onFilterFrequenciesChange(newVal)}
				disableCloseOnSelect
				getOptionLabel={(option) => capitalize(option)}
				renderOption={(props, option, state) =>
					renderMultiCheckbox(props, option, state, (o) => capitalize(o))
				}
				renderInput={(params) => (
					<TextField
						{...params}
						label="Frequency"
						placeholder="Select frequencies"
						sx={inputSx}
					/>
				)}
			/>
		</FormControl>
		{/* Status filter */}
		<FormControl sx={{ minWidth: 200 }}>
			<Autocomplete
				multiple
				size="small"
				options={PO_STATUSES}
				value={filterStatuses}
				onChange={(_, newVal) => onFilterStatusesChange(newVal as PoStatus[])}
				disableCloseOnSelect
				getOptionLabel={(option) => option}
				renderOption={(props, option, state) =>
					renderMultiCheckbox(props, option, state, (o) => o)
				}
				renderInput={(params) => (
					<TextField
						{...params}
						label="Status"
						placeholder="Select statuses"
						sx={inputSx}
					/>
				)}
			/>
		</FormControl>
	</Box>
);

export default PurchaseOrderFilters;
