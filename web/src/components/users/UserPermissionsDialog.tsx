import React, { useEffect, useState, useCallback } from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Box,
	Typography,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Checkbox,
	Alert,
	CircularProgress,
	Paper,
} from "@mui/material";
import { api } from "../../services/api";
import { useAbility } from "../../config/AbilityProvider";

/** Module subjects grouped by sidebar tabs, matching the backend Subject type.
 *  All subjects from the backend are listed here so setUserPermissions (which
 *  replaces ALL permissions atomically) does not silently drop subjects that
 *  are omitted from the payload.
 *  "Dashboard" is excluded — accessible to all authenticated users. */
const ALL_SUBJECTS = [
	"Requirements",
	"Prices",
	"MinStock",
	"PurchaseOrders",
	"InventoryItems",
	"Principals",
	"Suppliers",
	"Users",
	"Settings",
] as const;

type Action = "create" | "read" | "update" | "delete" | "manage";

// Ordered list of display actions
const ACTIONS: Action[] = ["read", "create", "update", "delete", "manage"];

/** Convert "MinStock" → "Min Stock", "PurchaseOrders" → "Purchase Orders" etc. */
const displayName = (subject: string): string =>
	subject.replace(/([a-z])([A-Z])/g, "$1 $2");

interface RawPermission {
	id: number;
	userId: number;
	subject: string;
	action: string;
}

interface UserPermissionsDialogProps {
	open: boolean;
	userId: number;
	userName: string;
	onClose: () => void;
}

/** Compute initial checkbox state from a raw permissions array */
function buildPermissionMap(
	permissions: RawPermission[],
): Record<string, Record<string, boolean>> {
	const map: Record<string, Record<string, boolean>> = {};
	for (const subj of ALL_SUBJECTS) {
		map[subj] = { create: false, read: false, update: false, delete: false, manage: false };
	}
	for (const perm of permissions) {
		if (map[perm.subject]) {
			map[perm.subject][perm.action] = true;
		}
	}
	return map;
}

/** Convert checkbox map back to the API's expected {subject, action}[] array */
function permissionMapToArray(
	map: Record<string, Record<string, boolean>>,
): Array<{ subject: string; action: string }> {
	const result: Array<{ subject: string; action: string }> = [];
	for (const [subject, actions] of Object.entries(map)) {
		for (const [action, checked] of Object.entries(actions)) {
			if (checked) {
				result.push({ subject, action });
			}
		}
	}
	return result;
}

const UserPermissionsDialog: React.FC<UserPermissionsDialogProps> = ({
	open,
	userId,
	userName,
	onClose,
}) => {
	const { refreshAbility } = useAbility();
	const [permissionMap, setPermissionMap] = useState<
		Record<string, Record<string, boolean>>
	>({});
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);

	const fetchPermissions = useCallback(async () => {
		setLoading(true);
		setError(null);
		setSaveError(null);
		try {
			const data = await api.apiRequest<RawPermission[]>(
				`/users/${userId}/permissions`,
				{ method: "GET" },
			);
			setPermissionMap(buildPermissionMap(data));
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load permissions",
			);
		} finally {
			setLoading(false);
		}
	}, [userId]);

	useEffect(() => {
		if (open) {
			fetchPermissions();
		}
	}, [open, fetchPermissions]);

	const handleToggle = (subject: string, action: string) => {
		setPermissionMap((prev) => {
			const updated = { ...prev };
			const row = { ...updated[subject] };

			if (action === "manage") {
				// Toggling manage: if checking manage, uncheck individual actions.
				// If unchecking manage, leave the other actions as-is.
				const newManage = !row.manage;
				row.manage = newManage;
				if (newManage) {
					row.create = false;
					row.read = false;
					row.update = false;
					row.delete = false;
				}
			} else {
				// Toggling an individual action: uncheck manage if it was set.
				const newVal = !row[action];
				row[action] = newVal;
				if (newVal) {
					row.manage = false;
				}
			}

			updated[subject] = row;
			return updated;
		});
	};

	const handleSave = async () => {
		setSaving(true);
		setSaveError(null);
		try {
			const body = permissionMapToArray(permissionMap);
			await api.apiRequest(`/users/${userId}/permissions`, {
				method: "POST",
				body: body as unknown as Record<string, unknown>,
			});
			// Refresh the ability so sidebar <Can> tags reflect new permissions
			await refreshAbility();
			onClose();
		} catch (err) {
			setSaveError(
				err instanceof Error ? err.message : "Failed to save permissions",
			);
		} finally {
			setSaving(false);
		}
	};

	const hasManage = (subject: string) => permissionMap[subject]?.manage ?? false;

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="md"
			fullWidth
			slotProps={{ paper: { sx: { borderRadius: 2 } } }}
		>
			<DialogTitle sx={{ pb: 0 }}>
				<Typography variant="h6" sx={{ fontWeight: 600 }}>
					User Permissions
				</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
					Managing permissions for <strong>{userName}</strong> (ID: {userId})
				</Typography>
			</DialogTitle>

			<DialogContent sx={{ pt: 2 }}>
				{error && (
					<Alert severity="error" sx={{ mb: 2 }}>
						{error}
					</Alert>
				)}

				{saveError && (
					<Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
						{saveError}
					</Alert>
				)}

				{loading ? (
					<Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
						<CircularProgress />
					</Box>
				) : (
					<TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
						<Table size="small">
							<TableHead>
								<TableRow>
									<TableCell sx={{ fontWeight: 600, width: 160 }}>
										Module
									</TableCell>
									{ACTIONS.map((action) => (
										<TableCell
											key={action}
											align="center"
											sx={{ fontWeight: 600, textTransform: "capitalize" }}
										>
											{action}
										</TableCell>
									))}
								</TableRow>
							</TableHead>
							<TableBody>
								{ALL_SUBJECTS.map((subject) => (
									<TableRow key={subject} hover>
										<TableCell
											component="th"
											scope="row"
											sx={{ fontWeight: 500 }}
										>
											{displayName(subject)}
										</TableCell>
										{ACTIONS.map((action) => {
											const isManageChecked = hasManage(subject);
											const isDisabled = action !== "manage" && isManageChecked;
											const checked = isManageChecked
												? action === "manage"
												: permissionMap[subject]?.[action] ?? false;

											return (
												<TableCell key={action} align="center">
												<Checkbox
													checked={checked}
													disabled={isDisabled}
													onChange={() => handleToggle(subject, action)}
													size="small"
													slotProps={{ input: { "aria-label": `${subject} ${action}` } }}
												/>
												</TableCell>
											);
										})}
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
				)}
			</DialogContent>

			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button onClick={onClose} disabled={saving} color="inherit">
					Cancel
				</Button>
				<Button
					onClick={handleSave}
					variant="contained"
					disabled={loading || saving}
					startIcon={saving ? <CircularProgress size={16} /> : undefined}
				>
					{saving ? "Saving..." : "Save"}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default UserPermissionsDialog;
