/**
 * InlineEditCell — Inline editable number cell with save/cancel controls.
 * Used by CategoriesCard and PrincipalsTab for threshold editing.
 */
import React from "react";
import { Box, TextField, Typography, IconButton } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";

interface InlineEditCellProps {
	editing: boolean;
	editValue: string;
	onEditChange: (value: string) => void;
	onSave: () => void;
	onCancel: () => void;
	saving: boolean;
	displayValue: string;
	step?: string;
	inputWidth?: number;
}

const InlineEditCell: React.FC<InlineEditCellProps> = ({
	editing,
	editValue,
	onEditChange,
	onSave,
	onCancel,
	saving,
	displayValue,
	step = "0.01",
	inputWidth = 70,
}) => {
	if (editing) {
		return (
			<Box
				sx={{
					display: "flex",
					gap: 0.5,
					alignItems: "center",
					justifyContent: "flex-end",
				}}
			>
				<TextField
					size="small"
					type="number"
					value={editValue}
					onChange={(e) => onEditChange(e.target.value)}
					slotProps={{
						htmlInput: {
							step,
							min: 0,
							style: { textAlign: "right", width: inputWidth },
						},
					}}
					sx={{ width: inputWidth + 20 }}
					disabled={saving}
					autoFocus
				/>
				<IconButton
					size="small"
					color="primary"
					onClick={onSave}
					disabled={saving}
				>
					<SaveIcon fontSize="small" />
				</IconButton>
				<IconButton size="small" onClick={onCancel} disabled={saving}>
					<CancelIcon fontSize="small" />
				</IconButton>
			</Box>
		);
	}
	return (
		<Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
			{displayValue}
		</Typography>
	);
};

export default InlineEditCell;
