/**
 * PrincipalsOverview — Card showing top principals by item count.
 */
import React from "react";
import {
	Box,
	Card,
	CardHeader,
	CardContent,
	Avatar,
	Typography,
	Button,
	Divider,
} from "@mui/material";
import { Link } from "react-router-dom";

interface PrincipalEntry {
	classID: string;
	description: string;
	itemCount: number;
}

interface PrincipalsOverviewProps {
	principals: PrincipalEntry[];
}

const PrincipalsOverview: React.FC<PrincipalsOverviewProps> = ({
	principals,
}) => (
	<Card sx={{ borderRadius: 3, height: "100%" }}>
		<CardHeader
			title="Principals Overview"
			action={
				<Button
					size="small"
					component={Link}
					to="/principals"
					sx={{ textTransform: "none" }}
				>
					View All
				</Button>
			}
			sx={{ pb: 0 }}
		/>
		<CardContent sx={{ pt: 1 }}>
			{principals.slice(0, 8).map((principal, index) => (
				<Box key={principal.classID}>
					{index > 0 && <Divider sx={{ my: 1.5 }} />}
					<Box
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 2,
						}}
					>
						<Avatar
							sx={{
								bgcolor: "primary.main",
								width: 40,
								height: 40,
								fontSize: "0.8rem",
								fontWeight: "bold",
								borderRadius: 2,
							}}
						>
							{principal.classID.slice(0, 2)}
						</Avatar>
						<Box sx={{ flexGrow: 1 }}>
							<Typography variant="body1" sx={{ fontWeight: "medium" }}>
								{principal.description || principal.classID}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								{principal.itemCount} item
								{principal.itemCount !== 1 ? "s" : ""}
							</Typography>
						</Box>
						<Typography
							variant="body2"
							sx={{
								fontWeight: "bold",
								color: "primary.main",
								minWidth: 32,
								textAlign: "right",
							}}
						>
							{principal.itemCount}
						</Typography>
					</Box>
				</Box>
			))}
			{principals.length === 0 && (
				<Typography
					variant="body2"
					color="text.secondary"
					sx={{ py: 2, textAlign: "center" }}
				>
					No principals found
				</Typography>
			)}
		</CardContent>
	</Card>
);

export default PrincipalsOverview;
