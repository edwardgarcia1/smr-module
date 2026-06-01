import React from "react";
import { Box, Typography, Chip, Stack } from "@mui/material";
import type { ComponentStock } from "../../config/requirements";

// ─── Component Chip ───────────────────────────────────────────────────────────

const ComponentChip: React.FC<{ component: ComponentStock }> = ({
	component,
}) => {
	const shortage = component.maxBundlesFromStock < 1;
	return (
		<Box
			sx={{
				display: "inline-flex",
				alignItems: "center",
				gap: 0.75,
				bgcolor: shortage ? "error.soft" : "success.soft",
				border: 1,
				borderColor: shortage ? "error.light" : "success.light",
				borderRadius: 1,
				px: 1,
				py: 0.25,
				fontSize: "0.75rem",
				whiteSpace: "nowrap",
			}}
			title={`${component.cmpnentID} — ${component.descr}\nAvailable: ${component.qtyAvail}\nQty per bundle: ${component.qtyPerBundle}\nMax bundles: ${component.maxBundlesFromStock}`}
		>
			<Typography
				component="span"
				variant="caption"
				sx={{ fontWeight: 600, fontSize: "0.7rem", color: "text.primary" }}
			>
				{component.cmpnentID}
			</Typography>
			<Typography
				component="span"
				variant="caption"
				sx={{ fontSize: "0.65rem", color: "text.secondary" }}
			>
				{component.qtyAvail} avail / {component.qtyPerBundle} ea
			</Typography>
			<Chip
				size="small"
				label={`x${component.maxBundlesFromStock}`}
				variant="outlined"
				color={shortage ? "error" : "success"}
				sx={{ height: 16, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.5 } }}
			/>
		</Box>
	);
};

// ─── Components List Cell ─────────────────────────────────────────────────────

const ComponentsListCell: React.FC<{ components: ComponentStock[] }> = ({
	components,
}) => {
	if (!components || components.length === 0)
		return (
			<Typography variant="caption" color="text.disabled">
				—
			</Typography>
		);
	return (
		<Stack
			direction="row"
			spacing={0.5}
			sx={{ flexWrap: "wrap", gap: 0.5, py: 0.5 }}
		>
			{components.map((c) => (
				<ComponentChip key={c.cmpnentID} component={c} />
			))}
		</Stack>
	);
};

export default ComponentsListCell;
