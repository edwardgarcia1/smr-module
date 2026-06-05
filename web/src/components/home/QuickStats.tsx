/**
 * QuickStats — Card showing key summary statistics.
 */
import React from "react";
import { Box, Card, CardHeader, CardContent, Typography } from "@mui/material";

interface StatEntry {
	label: string;
	value: string;
}

interface QuickStatsProps {
	stats: StatEntry[];
}

const QuickStats: React.FC<QuickStatsProps> = ({ stats }) => (
	<Card sx={{ borderRadius: 3, flexGrow: 1 }}>
		<CardHeader title="Quick Stats" sx={{ pb: 0 }} />
		<CardContent sx={{ pt: 1 }}>
			<Box
				sx={{
					display: "flex",
					flexDirection: "column",
					gap: 0.5,
				}}
			>
				{stats.map((stat, index) => (
					<Box
						key={index}
						sx={{
							display: "flex",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: 1,
							py: 1,
							...(index < stats.length - 1 && {
								borderBottom: 1,
								borderColor: "divider",
							}),
						}}
					>
						<Typography variant="body2" color="text.secondary">
							{stat.label}
						</Typography>
						<Typography
							variant="subtitle1"
							sx={{
								fontWeight: "bold",
								color: "primary.main",
								whiteSpace: "nowrap",
								fontVariantNumeric: "tabular-nums",
							}}
						>
							{stat.value}
						</Typography>
					</Box>
				))}
			</Box>
		</CardContent>
	</Card>
);

export default QuickStats;
