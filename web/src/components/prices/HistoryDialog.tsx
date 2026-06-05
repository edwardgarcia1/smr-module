import React from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Typography,
	TableContainer,
	Table,
	TableHead,
	TableRow,
	TableCell,
	TableBody,
	Chip,
} from "@mui/material";
import type { PriceHistoryEntry } from "../../config/prices";
import { fmtNum, fmtDate } from "../../config/prices";

interface HistoryDialogProps {
	open: boolean;
	onClose: () => void;
	inventoryId: string;
	history: PriceHistoryEntry[];
}

const HistoryDialog: React.FC<HistoryDialogProps> = ({
	open,
	onClose,
	inventoryId,
	history,
}) => (
	<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
		<DialogTitle>Price History — {inventoryId}</DialogTitle>
		<DialogContent>
			{history.length === 0 ? (
				<Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>
					No historical entries for this item.
				</Typography>
			) : (
				<TableContainer sx={{ maxHeight: 400 }}>
					<Table size="small" stickyHeader>
						<TableHead>
							<TableRow>
								<TableCell sx={{ fontWeight: 600 }}>Price Class</TableCell>
								<TableCell align="right" sx={{ fontWeight: 600 }}>
									Price
								</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Unit</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Valid From</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Valid To</TableCell>
								<TableCell sx={{ fontWeight: 600 }}>Encoded By</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{history.map((h, idx) => (
								<TableRow key={`${h.price_class}__${h.valid_from}__${idx}`}>
									<TableCell>
										<Chip
											label={h.price_class}
											size="small"
											variant="outlined"
										/>
									</TableCell>
									<TableCell align="right">{fmtNum(h.price)}</TableCell>
									<TableCell>{h.unit}</TableCell>
									<TableCell>{fmtDate(h.valid_from)}</TableCell>
									<TableCell>{fmtDate(h.valid_to)}</TableCell>
									<TableCell>{h.encoded_by}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			)}
		</DialogContent>
		<DialogActions>
			<Button onClick={onClose}>Close</Button>
		</DialogActions>
	</Dialog>
);

export default HistoryDialog;
