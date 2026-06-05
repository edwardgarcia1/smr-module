import React, { useState } from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Typography,
	Box,
	Alert,
	TableContainer,
	Table,
	TableHead,
	TableRow,
	TableCell,
	TableBody,
	IconButton,
	DialogContentText,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import apiRequest from "../../services/api";
import TableSkeleton from "../TableSkeleton";
import PriceClassDialog from "./PriceClassDialog";

interface PriceClassItem {
	id: string;
	description: string | null;
	created_by: string;
}

interface PriceClassesDialogProps {
	open: boolean;
	onClose: () => void;
	classes: PriceClassItem[];
	loading: boolean;
	error: string | null;
	onError: (msg: string | null) => void;
	onRefresh: () => Promise<void>;
}

const PriceClassesDialog: React.FC<PriceClassesDialogProps> = ({
	open,
	onClose,
	classes,
	loading,
	error,
	onError,
	onRefresh,
}) => {
	const [formDialogOpen, setFormDialogOpen] = useState(false);
	const [editItem, setEditItem] = useState<PriceClassItem | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [deleteConfirmItem, setDeleteConfirmItem] =
		useState<PriceClassItem | null>(null);

	const handleAdd = () => {
		setEditItem(null);
		setFormDialogOpen(true);
	};

	const handleEdit = (item: PriceClassItem) => {
		setEditItem(item);
		setFormDialogOpen(true);
	};

	const handleDelete = (item: PriceClassItem) => {
		setDeleteConfirmItem(item);
	};

	const handleDeleteConfirm = async () => {
		const item = deleteConfirmItem;
		if (!item) return;
		setDeleting(true);
		setDeleteConfirmItem(null);
		try {
			await apiRequest(`/price/classes/${encodeURIComponent(item.id)}`, {
				method: "DELETE",
			});
			await onRefresh();
		} catch (err: unknown) {
			onError(
				err instanceof Error ? err.message : "Failed to delete price class",
			);
		} finally {
			setDeleting(false);
		}
	};

	const handleDeleteCancel = () => {
		setDeleteConfirmItem(null);
	};

	const handleSaved = async () => {
		await onRefresh();
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle>
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						pr: 2,
					}}
				>
					<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
						<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
							Price Classes
						</Typography>
						{!loading && (
							<Typography variant="caption" sx={{ color: "text.secondary" }}>
								{classes.length} {classes.length === 1 ? "class" : "classes"}
							</Typography>
						)}
					</Box>
					<Button
						variant="outlined"
						size="small"
						startIcon={<AddIcon />}
						onClick={handleAdd}
						disabled={loading}
						sx={{ whiteSpace: "nowrap", minWidth: 100 }}
					>
						Add
					</Button>
				</Box>
			</DialogTitle>
			<DialogContent sx={{ minHeight: 200 }}>
				{error && (
					<Alert
						severity="error"
						sx={{ mb: 2 }}
						onClose={() => onError(null)}
					>
						{error}
					</Alert>
				)}

				{loading ? (
					<TableSkeleton
						cols={[{}, {}, {}, { icon: true, align: "right" }]}
						rows={4}
					/>
				) : classes.length === 0 ? (
					<Typography
						variant="body2"
						sx={{ color: "text.secondary", py: 4 }}
					>
						No price classes defined
					</Typography>
				) : (
					<TableContainer>
						<Table
							size="small"
							sx={{ "& th": { fontWeight: 600, fontSize: "0.75rem" } }}
						>
							<TableHead>
								<TableRow>
									<TableCell>Price Class</TableCell>
									<TableCell>Description</TableCell>
									<TableCell>Created By</TableCell>
									<TableCell align="right" sx={{ width: 100 }}>
										Actions
									</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{classes.map((pc) => {
									const isEditing = editItem?.id === pc.id;
									return (
										<TableRow
											key={pc.id}
											selected={isEditing}
											sx={{ "& > *": { borderBottom: "unset" } }}
										>
											<TableCell sx={{ fontWeight: 600 }}>{pc.id}</TableCell>
											<TableCell>{pc.description ?? "—"}</TableCell>
											<TableCell>{pc.created_by}</TableCell>
											<TableCell align="right" sx={{ width: 100 }}>
												<IconButton
													size="small"
													onClick={() => handleEdit(pc)}
													disabled={deleting}
													aria-label={`edit ${pc.id}`}
												>
													<EditIcon fontSize="small" />
												</IconButton>
												<IconButton
													size="small"
													onClick={() => handleDelete(pc)}
													disabled={deleting}
													aria-label={`delete ${pc.id}`}
												>
													<DeleteIcon fontSize="small" />
												</IconButton>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</TableContainer>
				)}

				<PriceClassDialog
					open={formDialogOpen}
					editItem={editItem}
					onClose={() => setFormDialogOpen(false)}
					onSaved={handleSaved}
					onError={onError}
				/>

				<Dialog
					open={deleteConfirmItem != null}
					onClose={handleDeleteCancel}
					maxWidth="xs"
					fullWidth
				>
					<DialogTitle>Delete Price Class?</DialogTitle>
					<DialogContent>
						<DialogContentText>
							Are you sure you want to delete price class{" "}
							<strong>{deleteConfirmItem?.id}</strong>? This action cannot be
							undone.
						</DialogContentText>
					</DialogContent>
					<DialogActions>
						<Button onClick={handleDeleteCancel} disabled={deleting}>
							Cancel
						</Button>
						<Button
							onClick={handleDeleteConfirm}
							variant="contained"
							color="error"
							disabled={deleting}
						>
							{deleting ? "Deleting..." : "Delete"}
						</Button>
					</DialogActions>
				</Dialog>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>Close</Button>
			</DialogActions>
		</Dialog>
	);
};

export default PriceClassesDialog;
