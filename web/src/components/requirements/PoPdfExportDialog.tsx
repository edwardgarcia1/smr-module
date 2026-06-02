/**
 * PO PDF Export Dialog
 *
 * Collects metadata for the Purchase Order PDF before export:
 *   - P.O. #
 *   - ATTN.
 *   - Prepared By, Endorsed By, Checked By, Approved By, Noted By
 *   - Company Logo (selectable from available logo images)
 */
import React, { useState, useCallback } from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	TextField,
	Button,
	Box,
	Typography,
	Card,
	CardMedia,
	Radio,
	RadioGroup,
	FormControlLabel,
	FormControl,
	FormLabel,
	IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useAuthStore } from "../../store/useAuthStore";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PoPdfExportFormData {
	poReference: string;
	attn: string;
	preparedBy: string;
	endorsedBy: string;
	checkedBy: string;
	approvedBy: string;
	notedBy: string;
	/** URL of the selected logo image (from import.meta.glob) */
	selectedLogoSrc: string;
}

export interface LogoOption {
	name: string;
	src: string;
}

interface PoPdfExportDialogProps {
	open: boolean;
	onClose: () => void;
	onExport: (data: PoPdfExportFormData) => void;
	initialValues?: Partial<PoPdfExportFormData>;
	logoOptions: LogoOption[];
	isExporting?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

const PoPdfExportDialog: React.FC<PoPdfExportDialogProps> = ({
	open,
	onClose,
	onExport,
	initialValues,
	logoOptions,
	isExporting = false,
}) => {
	const [poReference, setPoReference] = useState(initialValues?.poReference ?? "");
	const [attn, setAttn] = useState(initialValues?.attn ?? "");
	const currentUserName = useAuthStore.getState().user?.name ?? "";
	const [preparedBy, setPreparedBy] = useState(
		initialValues?.preparedBy ?? currentUserName,
	);
	const [endorsedBy, setEndorsedBy] = useState(initialValues?.endorsedBy ?? "");
	const [checkedBy, setCheckedBy] = useState(initialValues?.checkedBy ?? "");
	const [approvedBy, setApprovedBy] = useState(initialValues?.approvedBy ?? "");
	const [notedBy, setNotedBy] = useState(initialValues?.notedBy ?? "");
	const [selectedLogo, setSelectedLogo] = useState(initialValues?.selectedLogoSrc ?? (logoOptions[0]?.src ?? ""));
	const [poRefTouched, setPoRefTouched] = useState(false);

	const poRefError = poRefTouched && !poReference.trim();
	const canExport = poReference.trim().length > 0 && !isExporting;

	const handleExport = useCallback(() => {
		if (!poReference.trim()) {
			setPoRefTouched(true);
			return;
		}
		onExport({
			poReference,
			attn,
			preparedBy,
			endorsedBy,
			checkedBy,
			approvedBy,
			notedBy,
			selectedLogoSrc: selectedLogo,
		});
	}, [
		poReference,
		attn,
		preparedBy,
		endorsedBy,
		checkedBy,
		approvedBy,
		notedBy,
		selectedLogo,
		onExport,
	]);

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="sm"
			fullWidth
			PaperProps={{
				sx: { borderRadius: 2 },
			}}
		>
			<DialogTitle
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					px: 3,
					py: 2,
				}}
			>
				<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1.1rem" }}>
					Purchase Order Export
				</Typography>
				<IconButton size="small" onClick={onClose} aria-label="Close">
					<CloseIcon fontSize="small" />
				</IconButton>
			</DialogTitle>

			<DialogContent sx={{ px: 3, pb: 1 }}>
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
					{/* P.O. # */}
					<TextField
						size="small"
						label="P.O. #"
						value={poReference}
						onChange={(e) => {
							setPoReference(e.target.value);
							if (poRefTouched) setPoRefTouched(false);
						}}
						onBlur={() => setPoRefTouched(true)}
						error={poRefError}
						helperText={poRefError ? "P.O. # is required" : " "}
						required
						fullWidth
						sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
					/>

					{/* ATTN. */}
					<TextField
						size="small"
						label="ATTN."
						value={attn}
						onChange={(e) => setAttn(e.target.value)}
						fullWidth
						sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
					/>

				{/* Two-column signature block: left = Prepared, Checked, Endorsed | right = Noted, Approved */}
				<Box sx={{ display: "flex", gap: 2 }}>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
						<TextField
							size="small"
							label="Prepared By"
							value={preparedBy}
							disabled
							fullWidth
							sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
						/>
						<TextField
							size="small"
							label="Checked By"
							value={checkedBy}
							onChange={(e) => setCheckedBy(e.target.value)}
							fullWidth
							sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
						/>
						<TextField
							size="small"
							label="Endorsed By"
							value={endorsedBy}
							onChange={(e) => setEndorsedBy(e.target.value)}
							fullWidth
							sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
						/>
					</Box>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
						<TextField
							size="small"
							label="Noted By"
							value={notedBy}
							onChange={(e) => setNotedBy(e.target.value)}
							fullWidth
							sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
						/>
						<TextField
							size="small"
							label="Approved By"
							value={approvedBy}
							onChange={(e) => setApprovedBy(e.target.value)}
							fullWidth
							sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
						/>
					</Box>
				</Box>

					{/* Company Logo Selection */}
					<FormControl component="fieldset" sx={{ mt: 1 }}>
						<FormLabel
							component="legend"
							sx={{ fontSize: "0.875rem", fontWeight: 600, mb: 1 }}
						>
							Company Logo
						</FormLabel>
						<RadioGroup
							value={selectedLogo}
							onChange={(e) => setSelectedLogo(e.target.value)}
						>
							<Box
								sx={{
									display: "flex",
									gap: 2,
									flexWrap: "wrap",
								}}
							>
								{logoOptions.map((logo) => (
									<Card
										key={logo.src}
										variant="outlined"
										sx={{
											width: 160,
											cursor: "pointer",
											borderColor:
												selectedLogo === logo.src
													? "primary.main"
													: "divider",
											borderWidth: selectedLogo === logo.src ? 2 : 1,
											borderRadius: 2,
											transition: "border-color 0.15s",
											position: "relative",
											overflow: "hidden",
										}}
										onClick={() => setSelectedLogo(logo.src)}
									>
										<FormControlLabel
											value={logo.src}
											control={<Radio size="small" />}
											label=""
											sx={{
												position: "absolute",
												top: 2,
												right: 2,
												m: 0,
												zIndex: 1,
											}}
										/>
										<CardMedia
											component="img"
											image={logo.src}
											alt={logo.name}
											sx={{
												width: "100%",
												height: 80,
												objectFit: "contain",
												objectPosition: "center",
												pt: 1,
												pb: 0.5,
												px: 1,
											}}
										/>
										<Typography
											variant="caption"
											sx={{
												display: "block",
												textAlign: "center",
												pb: 1,
												fontWeight: selectedLogo === logo.src ? 600 : 400,
												color:
													selectedLogo === logo.src
														? "primary.main"
														: "text.secondary",
											}}
										>
											{logo.name}
										</Typography>
									</Card>
								))}
							</Box>
						</RadioGroup>
					</FormControl>
				</Box>
			</DialogContent>

			<DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
				<Button
					onClick={onClose}
					variant="outlined"
					disabled={isExporting}
					sx={{ textTransform: "none", borderRadius: 2 }}
				>
					Cancel
				</Button>
				<Button
					onClick={handleExport}
					variant="contained"
					disabled={!canExport}
					sx={{ textTransform: "none", borderRadius: 2 }}
				>
					{isExporting ? "Exporting..." : "Export PDF"}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default PoPdfExportDialog;
