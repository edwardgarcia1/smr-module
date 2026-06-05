/**
 * PoStatusChip — Reusable status chip/select for Purchase Orders.
 * Eliminates the duplicated chipColors map found in PurchaseOrders.tsx.
 */
import React from "react";
import { Chip, Select, MenuItem, type SelectProps } from "@mui/material";

export type PoStatus = "Pending" | "Printed" | "Approved" | "Encoded" | "Cancelled";
export const PO_STATUSES: PoStatus[] = ["Pending", "Printed", "Approved", "Encoded", "Cancelled"];

export const PO_STATUS_CHIP_COLORS: Record<string, { bg: string; color: string }> = {
	Pending: { bg: "warning.soft", color: "warning.dark" },
	Printed: { bg: "info.soft", color: "info.dark" },
	Approved: { bg: "success.soft", color: "success.dark" },
	Encoded: { bg: "secondary.soft", color: "secondary.dark" },
	Cancelled: { bg: "error.soft", color: "error.dark" },
};

interface PoStatusChipProps {
	status: PoStatus;
}

/** Render a PO status as a colored chip. */
export const PoStatusChip: React.FC<PoStatusChipProps> = ({ status }) => {
	const cc = PO_STATUS_CHIP_COLORS[status] ?? {};
	return (
		<Chip
			size="small"
			label={status}
			sx={{
				fontWeight: 600,
				fontSize: "0.75rem",
				bgcolor: cc.bg,
				color: cc.color,
				height: 24,
			}}
		/>
	);
};

interface PoStatusSelectProps extends Omit<SelectProps, "renderValue"> {
	status: PoStatus;
	onStatusChange: (newStatus: PoStatus) => void;
	/** The allowed transitions — defaults to ["Approved", "Encoded", "Cancelled"] */
	allowedTransitions?: PoStatus[];
}

/**
 * Dropdown to change a PO status, displaying the current value as a colored chip.
 */
export const PoStatusSelect: React.FC<PoStatusSelectProps> = ({
	status,
	onStatusChange,
	allowedTransitions = ["Approved", "Encoded", "Cancelled"],
	...selectProps
}) => (
	<Select
		size="small"
		value={status}
		onChange={(e) => onStatusChange(e.target.value as PoStatus)}
		sx={{
			minWidth: 110,
			fontWeight: 600,
			fontSize: "0.8125rem",
			borderRadius: 2,
			"& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" },
		}}
		renderValue={(val) => <PoStatusChip status={val as PoStatus} />}
		{...selectProps}
	>
		{allowedTransitions.map((s) => (
			<MenuItem key={s} value={s}>
				{s}
			</MenuItem>
		))}
	</Select>
);
