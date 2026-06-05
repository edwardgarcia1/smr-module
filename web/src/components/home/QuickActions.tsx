/**
 * QuickActions — Card with shortcut buttons to key pages.
 */
import React from "react";
import { Box, Card, CardHeader, CardContent, Button } from "@mui/material";
import { Link } from "react-router-dom";

interface ActionEntry {
	label: string;
	path: string;
	icon: React.ReactNode;
}

interface QuickActionsProps {
	actions: ActionEntry[];
}

const QuickActions: React.FC<QuickActionsProps> = ({ actions }) => (
	<Card sx={{ borderRadius: 3, flexGrow: 1 }}>
		<CardHeader title="Quick Actions" sx={{ pb: 0 }} />
		<CardContent sx={{ pt: 1 }}>
			<Box
				sx={{
					display: "flex",
					flexDirection: "column",
					gap: 1,
				}}
			>
				{actions.map((action, index) => (
					<Button
						key={index}
						component={Link}
						to={action.path}
						variant="outlined"
						startIcon={action.icon}
						sx={{
							justifyContent: "flex-start",
							textAlign: "left",
							px: 2,
							py: 1,
							textTransform: "none",
							borderColor: "grey.300",
							color: "text.primary",
							"&:hover": {
								borderColor: "primary.main",
								bgcolor: "action.hover",
							},
						}}
					>
						{action.label}
					</Button>
				))}
			</Box>
		</CardContent>
	</Card>
);

export default QuickActions;
