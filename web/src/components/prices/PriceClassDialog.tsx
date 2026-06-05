import React, { useState, useEffect } from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Box,
	TextField,
	Alert,
} from "@mui/material";
import apiRequest from "../../services/api";

interface PriceClassItem {
	id: string;
	description: string | null;
	created_by: string;
}

interface PriceClassDialogProps {
	open: boolean;
	editItem: PriceClassItem | null;
	onClose: () => void;
	onSaved: () => void;
	onError: (msg: string) => void;
}

const PriceClassDialog: React.FC<PriceClassDialogProps> = ({
	open,
	editItem,
	onClose,
	onSaved,
	onError,
}) => {
	const isEdit = editItem != null;
	const [classId, setClassId] = useState("");
	const [description, setDescription] = useState("");
	const [saving, setSaving] = useState(false);
	const [dialogError, setDialogError] = useState<string | null>(null);

	useEffect(() => {
		setClassId(isEdit ? editItem.id : "");
		setDescription(isEdit ? (editItem.description ?? "") : "");
		setDialogError(null);
	}, [open, isEdit, editItem]);

	const dialogKey = open
		? isEdit
			? `edit-${editItem.id}`
			: "add-new"
		: "closed";

	const handleSave = async () => {
		setDialogError(null);

		if (!classId.trim()) {
			setDialogError("Price class ID is required");
			return;
		}

		setSaving(true);

		try {
			if (isEdit) {
				await apiRequest(`/price/classes/${encodeURIComponent(classId)}`, {
					method: "PUT",
					body: { description: description.trim() || null },
				});
			} else {
				await apiRequest("/price/classes", {
					method: "POST",
					body: {
						id: classId.trim(),
						description: description.trim() || null,
					},
				});
			}

			onSaved();
			onClose();
		} catch (err: unknown) {
			const msg =
				err instanceof Error ? err.message : "Failed to save price class";
			setDialogError(msg);
			onError(msg);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog
			key={dialogKey}
			open={open}
			onClose={onClose}
			maxWidth="sm"
			fullWidth
		>
			<DialogTitle>
				{isEdit ? "Edit Price Class" : "Add Price Class"}
			</DialogTitle>
			<DialogContent>
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
					{dialogError && (
						<Alert
							severity="error"
							onClose={() => setDialogError(null)}
							sx={{ mb: 1 }}
						>
							{dialogError}
						</Alert>
					)}
					<TextField
						label="Price Class ID"
						value={classId}
						onChange={(e) => {
							setClassId(e.target.value);
							setDialogError(null);
						}}
						disabled={isEdit}
						size="small"
						required
					/>
					<TextField
						label="Description"
						value={description}
						onChange={(e) => {
							setDescription(e.target.value);
							setDialogError(null);
						}}
						size="small"
						multiline
						rows={2}
					/>
				</Box>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose} disabled={saving}>
					Cancel
				</Button>
				<Button variant="contained" onClick={handleSave} disabled={saving}>
					{saving ? "Saving..." : "Save"}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default PriceClassDialog;
