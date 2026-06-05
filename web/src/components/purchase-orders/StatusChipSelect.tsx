/**
 * StatusChipSelect — Renders a Select with Chip-styled options for PO status.
 */
import React from "react";
import { Select, MenuItem, Chip, type SelectProps } from "@mui/material";
import { PO_STATUSES, STATUS_CHIP_COLORS, type PoStatus } from "../../config/purchaseOrders";

interface StatusChipSelectProps {
	value: PoStatus;
	onChange: (newStatus: PoStatus) => void;
	sx?: SelectProps["sx"];
	disabledOptions?: PoStatus[];
}

function renderStatusChip(val: PoStatus) {
	const cc = STATUS_CHIP_COLORS[val] ?? {};
	return (
		<Chip
			size="small"
			label={val}
			sx={{
				fontWeight: 600,
				fontSize: "0.75rem",
				bgcolor: cc.bg,
				color: cc.color,
				height: 24,
			}}
		/>
	);
}

const StatusChipSelect: React.FC<StatusChipSelectProps> = ({
	value,
	onChange,
	sx,
	disabledOptions,
}) => (
	<Select
		size="small"
		value={value}
		onChange={(e) => onChange(e.target.value as PoStatus)}
		sx={{
			minWidth: 110,
			fontWeight: 600,
			fontSize: "0.8125rem",
			borderRadius: 2,
			"& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" },
			...sx,
		}}
		renderValue={(val) => renderStatusChip(val as PoStatus)}
	>
		{PO_STATUSES.map((s) => (
			<MenuItem
				key={s}
				value={s}
				disabled={disabledOptions?.includes(s)}
			>
				{s}
			</MenuItem>
		))}
	</Select>
);

export default StatusChipSelect;
