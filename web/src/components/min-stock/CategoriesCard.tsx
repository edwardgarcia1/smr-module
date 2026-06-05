/**
 * CategoriesCard — Min stock categories threshold table with inline editing.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
	Box,
	Paper,
	Typography,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableRow,
	IconButton,
	CircularProgress,
	Alert,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import apiRequest from "../../services/api";
import { type CategoryRow } from "../../config/minStock";
import InlineEditCell from "./InlineEditCell";

const CategoriesCard: React.FC = () => {
	const [categories, setCategories] = useState<CategoryRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [editingId, setEditingId] = useState<number | null>(null);
	const [editValue, setEditValue] = useState("");
	const [saving, setSaving] = useState(false);

	const fetchCategories = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await apiRequest<CategoryRow[]>("/min-stock/categories");
			const order = ["Immediate", "Secondary", "Monitoring", "Overstocked"];
			data.sort(
				(a, b) =>
					order.indexOf(a.category_name) - order.indexOf(b.category_name),
			);
			setCategories(data);
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : "Failed to fetch categories",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchCategories();
	}, [fetchCategories]);

	const handleEditOpen = (row: CategoryRow) => {
		setEditingId(row.id);
		setEditValue(row.threshold !== null ? String(row.threshold) : "");
	};

	const handleEditCancel = () => {
		setEditingId(null);
	};

	const handleEditSave = async () => {
		if (editingId === null) return;
		const val = editValue.trim() === "" ? null : parseFloat(editValue);
		if (val !== null && (isNaN(val) || val < 0)) {
			setError("Threshold must be a valid non-negative number");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await apiRequest(`/min-stock/categories/${editingId}`, {
				method: "PATCH",
				body: { threshold: val },
			});
			setCategories((prev) =>
				prev.map((c) =>
					c.id === editingId ? { ...c, threshold: val } : c,
				),
			);
			setEditingId(null);
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : "Failed to update category",
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Paper sx={{ mb: 3, borderRadius: 2, overflow: "hidden" }}>
			<Box
				sx={{
					px: 2.5,
					py: 1.5,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					borderBottom: 1,
					borderColor: "divider",
				}}
			>
				<Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
					Min Stock Categories
				</Typography>
				{error && (
					<Alert
						severity="error"
						sx={{ py: 0, flex: 1 }}
						onClose={() => setError(null)}
					>
						{error}
					</Alert>
				)}
			</Box>
			<Box sx={{ p: 0 }}>
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell sx={{ fontWeight: 600, width: 160 }}>
								Category
							</TableCell>
							<TableCell sx={{ fontWeight: 600 }}>
								Description
							</TableCell>
							<TableCell sx={{ fontWeight: 600 }} align="right">
								Threshold
							</TableCell>
							<TableCell
								sx={{ fontWeight: 600, width: 80 }}
								align="right"
							>
								Actions
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{loading ? (
							<TableRow>
								<TableCell colSpan={4} align="center" sx={{ py: 2 }}>
									<CircularProgress size={20} />
								</TableCell>
							</TableRow>
						) : (
							categories.map((row) => {
								let description = "";
								if (row.category_name === "Immediate")
									description = "ratio < threshold";
								else if (row.category_name === "Overstocked")
									description =
										"ratio ≥ threshold (everything above monitoring threshold)";
								else description = "ratio < threshold";

								return (
									<TableRow key={row.id} hover>
										<TableCell sx={{ fontWeight: 600 }}>
											{row.category_name}
										</TableCell>
										<TableCell
											sx={{
												color: "text.secondary",
												fontSize: "0.8rem",
											}}
										>
											{description}
										</TableCell>
										<TableCell align="right">
											<InlineEditCell
												editing={editingId === row.id}
												editValue={editValue}
												onEditChange={setEditValue}
												onSave={handleEditSave}
												onCancel={handleEditCancel}
												saving={saving}
												displayValue={
													row.threshold !== null
														? row.threshold.toLocaleString(undefined, {
																minimumFractionDigits: 2,
																maximumFractionDigits: 2,
															})
														: "—"
												}
												step="0.01"
												inputWidth={70}
											/>
										</TableCell>
										<TableCell align="right">
											{row.category_name === "Overstocked" ? (
												<Typography
													variant="caption"
													sx={{
														color: "text.disabled",
														fontStyle: "italic",
													}}
												>
													Fixed
												</Typography>
											) : (
												<IconButton
													size="small"
													onClick={() => handleEditOpen(row)}
													disabled={editingId !== null}
												>
													<EditIcon fontSize="small" />
												</IconButton>
											)}
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</Box>
		</Paper>
	);
};

export default CategoriesCard;
