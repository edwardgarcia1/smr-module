/**
 * DashboardCards — Row of metric cards linking to key pages.
 */
import React from "react";
import {
	Box,
	Card,
	CardHeader,
	CardContent,
	Avatar,
	Typography,
} from "@mui/material";
import { Link } from "react-router-dom";

export interface DashboardCardData {
	id: number;
	title: string;
	value: string;
	subtitle: string;
	icon: React.ReactNode;
	color: string;
	path: string;
}

interface DashboardCardsProps {
	cards: DashboardCardData[];
}

const DashboardCards: React.FC<DashboardCardsProps> = ({ cards }) => (
	<Box
		sx={{
			display: "grid",
			gridTemplateColumns: {
				xs: "1fr",
				sm: "repeat(1, 1fr)",
				md: "repeat(2, 1fr)",
				lg: "repeat(2, 1fr)",
				xl: "repeat(3, 1fr)",
			},
			gap: 2,
			width: "100%",
			mb: 3,
		}}
	>
		{cards.map((card) => (
			<Link key={card.id} to={card.path} style={{ textDecoration: "none" }}>
				<Card
					sx={{
						height: "100%",
						display: "flex",
						flexDirection: "column",
						borderRadius: 3,
						cursor: "pointer",
						"&:hover": {
							boxShadow: 6,
							transform: "translateY(-2px)",
							transition: "all 0.2s ease-in-out",
						},
					}}
				>
					<CardHeader
						avatar={
							<Avatar
								sx={{
									bgcolor: card.color,
									width: 48,
									height: 48,
									fontSize: "1.5rem",
									borderRadius: 2,
								}}
							>
								{card.icon}
							</Avatar>
						}
						title={
							<Typography
								variant="h6"
								component="div"
								sx={{ fontSize: "1rem" }}
							>
								{card.title}
							</Typography>
						}
						sx={{ pb: 0 }}
					/>
					<CardContent sx={{ pt: 1, flexGrow: 1 }}>
						<Box sx={{ mt: 1 }}>
							<Typography
								variant="h4"
								sx={{
									fontWeight: "bold",
									color: card.color,
									mb: 0.5,
								}}
							>
								{card.value}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								{card.subtitle}
							</Typography>
						</Box>
					</CardContent>
				</Card>
			</Link>
		))}
	</Box>
);

export default DashboardCards;
