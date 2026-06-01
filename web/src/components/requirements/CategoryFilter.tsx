import React from "react";
import {
	Autocomplete,
	TextField,
	Checkbox,
	Chip,
	Typography,
} from "@mui/material";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import type { CategoryColorScheme } from "../../config/requirements";
import { CATEGORY_NAMES } from "../../config/requirements";

interface CategoryFilterProps {
	selectedCategories: string[];
	onChange: (categories: string[]) => void;
	getCategoryColor: (cat: string) => CategoryColorScheme;
}

/**
 * Shared category multi-select autocomplete.
 * Used in both PurchasingToolbar and BundlingToolbar (DRY).
 */
const CategoryFilter: React.FC<CategoryFilterProps> = ({
	selectedCategories,
	onChange,
	getCategoryColor,
}) => {
	return (
		<Autocomplete
			multiple
			size="small"
			options={[...CATEGORY_NAMES]}
			value={selectedCategories}
			onChange={(_, newVal) => onChange(newVal)}
			disableCloseOnSelect
			sx={{ width: 220 }}
			renderValue={(value, getItemProps) =>
				(value as string[]).map((option, index) => {
					const { key, ...itemProps } = getItemProps({ index });
					const cc = getCategoryColor(option);
					return (
						<Chip
							key={key}
							{...itemProps}
							label={option}
							size="small"
							variant="filled"
							sx={{
								backgroundColor: `${cc.chipBg} !important`,
								color: `${cc.chipText} !important`,
								fontWeight: 700,
								"& .MuiChip-deleteIcon": {
									color: `${cc.chipText} !important`,
									fontSize: 18,
									opacity: 0.85,
									"&:hover": { opacity: 1 },
								},
							}}
						/>
					);
				})
			}
			renderOption={(props, option, { selected }) => {
				const { key, ...rest } = props;
				const cc = getCategoryColor(option);
				return (
					<li
						key={key}
						{...rest}
						style={{
							backgroundColor: selected ? cc.bg : undefined,
							borderLeft: `4px solid ${cc.chipBg}`,
							marginBottom: 1,
						}}
					>
						<Checkbox
							icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
							checkedIcon={<CheckBoxIcon fontSize="small" />}
							checked={selected}
							sx={{
								color: cc.chipBg,
								"&.Mui-checked": { color: cc.chipBg },
							}}
						/>
						<Typography variant="body2" sx={{ fontWeight: 500 }}>
							{option}
						</Typography>
					</li>
				);
			}}
			renderInput={(params) => (
				<TextField
					{...params}
					label="Category"
					placeholder="Filter by category"
					sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
				/>
			)}
		/>
	);
};

export default CategoryFilter;
