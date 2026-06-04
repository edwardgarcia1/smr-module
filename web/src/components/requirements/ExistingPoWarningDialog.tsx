/**
 * ExistingPoWarningDialog — Warns the user about existing active purchase orders
 * for the selected principal before running a new requirements query.
 *
 * The requirements feature suggests orders based on inventory (unreleased, incoming,
 * on hand, available). When active POs (not "Encoded" or "Cancelled") already exist
 * for the same principal, the user should resolve them first.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Paper,
	Typography,
	Alert,
	Chip,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ShoppingBasketIcon from "@mui/icons-material/ShoppingBasket";

// ─── Types ────────────────────────────────────────────────────────────

export interface ConflictingPo {
	id: number;
	ref_num: string;
	site_id: string;
	demand_mode: string;
	frequency: string;
	created_by: string;
	last_update_at: string | null;
	last_update_by: string | null;
	status: string;
	status_from: string | null;
	status_by: string | null;
	created_at: string;
}

interface ExistingPoWarningDialogProps {
	open: boolean;
	poList: ConflictingPo[];
	onClose: () => void;
	onContinue: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────

const formatDate = (dateStr: string | null): string => {
	if (!dateStr) return "—";
	try {
		return new Date(dateStr).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return dateStr;
	}
};

const formatSimpleDate = (dateStr: string): string => {
	if (!dateStr) return "—";
	try {
		return new Date(dateStr).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	} catch {
		return dateStr;
	}
};

const capitalize = (str: string): string => {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const statusChipColor = (status: string) => {
	switch (status) {
		case "Pending":  return "warning" as const;
		case "Printed":  return "info" as const;
		case "Approved": return "success" as const;
		default:         return "default" as const;
	}
};

// ─── Component ────────────────────────────────────────────────────────

const ExistingPoWarningDialog: React.FC<ExistingPoWarningDialogProps> = ({
	open,
	poList,
	onClose,
	onContinue,
}) => {
	const navigate = useNavigate();

	const handleGoToPurchaseOrders = () => {
		onClose();
		navigate("/purchase-orders");
	};

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="xl"
			fullWidth
			slotProps={{ paper: { sx: { borderRadius: 2 } } }}
		>
			<DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
				<WarningAmberIcon color="warning" />
				<Typography variant="h6" sx={{ fontWeight: 600 }}>
					Active Purchase Orders Found
				</Typography>
			</DialogTitle>

			<DialogContent sx={{ pb: 0 }}>
				<Alert severity="warning" sx={{ mb: 2 }}>
					<Typography variant="body2" sx={{ fontWeight: 500 }}>
						There are existing purchase orders for this principal that have not been finalized.
						Please resolve them before running a new requirements query.
					</Typography>
					<Typography variant="body2" sx={{ mt: 0.5 }}>
						Set the PO status to <strong>Encoded</strong> if the order has been encoded in the
						inventory system, or set it to <strong>Cancelled</strong> if it was cancelled.
					</Typography>
				</Alert>

				<TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
					<Table size="small" stickyHeader>
						<TableHead>
							<TableRow>
								<TableCell sx={{ fontWeight: 600 }}>Ref Nbr</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Site(s)</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Demand Mode</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Frequency</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Created By</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Last Updated</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Updated By</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Status From</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Status By</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{poList.map((po) => (
								<TableRow key={po.id} hover>
									<TableCell sx={{ fontWeight: 600 }}>{po.ref_num}</TableCell>
									<TableCell>
										{po.site_id && po.site_id.trim() ? po.site_id : "ALL SITES"}
									</TableCell>
									<TableCell>{capitalize(po.demand_mode)}</TableCell>
									<TableCell>{capitalize(po.frequency)}</TableCell>
									<TableCell>{po.created_by || "—"}</TableCell>
									<TableCell>{formatDate(po.last_update_at)}</TableCell>
									<TableCell>{po.last_update_by || "—"}</TableCell>
									<TableCell>
										<Chip
											size="small"
											label={po.status}
											color={statusChipColor(po.status)}
											variant="outlined"
											sx={{ fontWeight: 600, fontSize: "0.75rem" }}
										/>
									</TableCell>
									<TableCell>{formatDate(po.status_from)}</TableCell>
									<TableCell>{po.status_by || "—"}</TableCell>
									<TableCell>{formatSimpleDate(po.created_at)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			</DialogContent>

			<DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
				<Button
					variant="outlined"
					color="warning"
					startIcon={<WarningAmberIcon />}
					onClick={onContinue}
				>
					Continue Anyway
				</Button>
				<Button
					variant="contained"
					startIcon={<ShoppingBasketIcon />}
					onClick={handleGoToPurchaseOrders}
				>
					Go to Purchase Orders
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default ExistingPoWarningDialog;
