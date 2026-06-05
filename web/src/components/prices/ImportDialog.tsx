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
} from "@mui/material";
import * as XLSX from "xlsx";
import Big from "big.js";
import type { ImportRow } from "../../config/prices";
import { fmtNum } from "../../config/prices";

interface ImportPreviewRow {
	row: number;
	inventory_id: string;
	price: number;
	unit: string;
	price_class: string;
	valid_from: string;
	valid_to: string;
	error?: string;
}

interface ImportDialogProps {
	open: boolean;
	onClose: () => void;
	onImport: (rows: ImportRow[]) => Promise<void>;
	importing: boolean;
	importResult: string | null;
}

const ImportDialog: React.FC<ImportDialogProps> = ({
	open,
	onClose,
	onImport,
	importing,
	importResult,
}) => {
	const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
	const [fileError, setFileError] = useState<string | null>(null);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFileError(null);
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (evt) => {
			try {
				const data = new Uint8Array(evt.target?.result as ArrayBuffer);
				const workbook = XLSX.read(data, { type: "array" });
				const sheet = workbook.Sheets[workbook.SheetNames[0]];
				const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

				const parsed: ImportPreviewRow[] = json.map((row, idx) => {
					const r = idx + 2;
					const invId = String(
						row.inventory_id ?? row.InventoryID ?? row.InvtID ?? "",
					).trim();
					const priceRaw = Number(row.price ?? row.Price ?? row.Cost ?? 0);
					const price = isNaN(priceRaw)
						? 0
						: Number(new Big(priceRaw).toFixed(4));
					const unit = String(row.unit ?? row.Unit ?? row.SlsUnit ?? "")
						.trim()
						.toUpperCase();
					const priceClass = String(
						row.price_class ?? row.PriceClass ?? row.priceClass ?? "",
					).trim();
					const vf = String(
						row.valid_from ?? row.ValidFrom ?? row.validFrom ?? "",
					).trim();
					const vt = String(
						row.valid_to ?? row.ValidTo ?? row.validTo ?? "",
					).trim();

					const err =
						!invId || isNaN(price) || !unit || !priceClass
							? "Missing required fields"
							: undefined;

					return {
						row: r,
						inventory_id: invId,
						price: isNaN(price) ? 0 : price,
						unit,
						price_class: priceClass,
						valid_from: vf,
						valid_to: vt,
						error: err,
					};
				});

				setPreview(parsed);
			} catch {
				setFileError(
					"Failed to parse Excel file. Ensure it's a valid .xlsx or .xls file.",
				);
			}
		};
		reader.readAsArrayBuffer(file);
	};

	const validRows = preview.filter((r) => !r.error);
	const hasErrors = preview.some((r) => r.error);

	const handleImport = async () => {
		if (validRows.length === 0) return;
		await onImport(
			validRows.map((r) => ({
				inventory_id: r.inventory_id,
				price: r.price,
				unit: r.unit,
				price_class: r.price_class,
				valid_from: r.valid_from || undefined,
				valid_to: r.valid_to || undefined,
			})),
		);
	};

	const reset = () => {
		setPreview([]);
		setFileError(null);
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	return (
		<Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
			<DialogTitle>Import Item Prices from Excel</DialogTitle>
			<DialogContent>
				<Box sx={{ mb: 2, mt: 1 }}>
					<Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
						Select an Excel file (.xlsx, .xls) with columns:{" "}
						<strong>inventory_id</strong>, <strong>price</strong>,{" "}
						<strong>unit</strong>, <strong>price_class</strong> (optional:{" "}
						<strong>valid_from</strong>, <strong>valid_to</strong>).
					</Typography>
					<Button variant="contained" component="label">
						Choose File
						<input
							type="file"
							hidden
							accept=".xlsx,.xls"
							onChange={handleFileSelect}
						/>
					</Button>
				</Box>

				{fileError && (
					<Alert severity="error" sx={{ mb: 2 }}>
						{fileError}
					</Alert>
				)}

				{importResult && (
					<Alert
						severity={importResult.includes("Error") ? "warning" : "success"}
						sx={{ mb: 2 }}
					>
						{importResult}
					</Alert>
				)}

				{preview.length > 0 && (
					<>
						<Typography variant="subtitle2" sx={{ mb: 1 }}>
							Preview ({validRows.length} valid rows
							{hasErrors
								? `, ${preview.length - validRows.length} with errors`
								: ""}
							)
						</Typography>
						<TableContainer sx={{ maxHeight: 300 }}>
							<Table size="small" stickyHeader>
								<TableHead>
									<TableRow>
										<TableCell>#</TableCell>
										<TableCell>Inventory ID</TableCell>
										<TableCell align="right">Price</TableCell>
										<TableCell>Unit</TableCell>
										<TableCell>Price Class</TableCell>
										<TableCell>Valid From</TableCell>
										<TableCell>Valid To</TableCell>
										{hasErrors && <TableCell>Error</TableCell>}
									</TableRow>
								</TableHead>
								<TableBody>
									{preview.map((r) => (
										<TableRow
											key={r.row}
											selected={!!r.error}
											sx={
												r.error
													? { "& td": { color: "error.main" } }
													: undefined
											}
										>
											<TableCell>{r.row}</TableCell>
											<TableCell>{r.inventory_id}</TableCell>
											<TableCell align="right">{fmtNum(r.price)}</TableCell>
											<TableCell>{r.unit}</TableCell>
											<TableCell>{r.price_class}</TableCell>
											<TableCell>{r.valid_from}</TableCell>
											<TableCell>{r.valid_to}</TableCell>
											{hasErrors && <TableCell>{r.error ?? ""}</TableCell>}
										</TableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>
					</>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={handleClose}>Cancel</Button>
				<Button
					variant="contained"
					onClick={handleImport}
					disabled={validRows.length === 0 || importing}
				>
					{importing ? "Importing..." : `Import ${validRows.length} rows`}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default ImportDialog;
