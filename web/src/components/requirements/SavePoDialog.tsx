/**
 * SavePoDialog — Dialog prompting for a reference number before saving
 * the current purchasing grid snapshot as a purchase order.
 */
import React, { useCallback, useState } from "react";
import {
	Alert,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	TextField,
	CircularProgress,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";

interface SavePoDialogProps {
	open: boolean;
	onClose: () => void;
	onSave: (refNum: string) => Promise<void>;
	isSaving: boolean;
	defaultRefNum?: string;
}

const SavePoDialog: React.FC<SavePoDialogProps> = ({
	open,
	onClose,
	onSave,
	isSaving,
	defaultRefNum = "",
}) => {
	const [refNum, setRefNum] = useState(defaultRefNum);
	const [error, setError] = useState<string | null>(null);

	const handleSave = useCallback(async () => {
		if (!refNum.trim()) return;
		setError(null);
		try {
			await onSave(refNum.trim());
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to save purchase order.";
			setError(msg);
		}
	}, [refNum, onSave]);

	const handleClose = useCallback(() => {
		if (!isSaving) {
			setRefNum(defaultRefNum);
			setError(null);
			onClose();
		}
	}, [isSaving, defaultRefNum, onClose]);

	return (
		<Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
			<DialogTitle>Save Purchase Order</DialogTitle>
			<DialogContent>
				{error && (
					<Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
						{error}
					</Alert>
				)}
				<TextField
					autoFocus
					margin="dense"
					label="Reference Number"
					fullWidth
					value={refNum}
					onChange={(e) => setRefNum(e.target.value)}
					disabled={isSaving}
					placeholder="e.g. PO-2024-001"
					sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
				/>
			</DialogContent>
			<DialogActions>
				<Button onClick={handleClose} disabled={isSaving}>
					Cancel
				</Button>
				<Button
					variant="contained"
					startIcon={
						isSaving ? <CircularProgress size={16} thickness={2.5} /> : <SaveIcon />
					}
					onClick={handleSave}
					disabled={isSaving || !refNum.trim()}
				>
					{isSaving ? "Saving..." : "Save"}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default SavePoDialog;
