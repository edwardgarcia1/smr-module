import React from 'react';
import {
	Box,
	Card,
	CardHeader,
	CardContent,
	Avatar,
	Typography,
} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import VisibilityIcon from "@mui/icons-material/Visibility";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import { useAuthStore } from '../store/useAuthStore';

const Home: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  const dashboardCards = [
    {
      id: 1,
      title: "Immediate Purchase",
      value: 5,
      subtitle: "Items requiring urgent reorder",
      icon: <ShoppingCartIcon />,
      color: "error.main",
    },
    {
      id: 2,
      title: "Secondary Purchase",
      value: 4,
      subtitle: "Items approaching reorder point",
      icon: <Inventory2Icon />,
      color: "warning.main",
    },
    {
      id: 3,
      title: "Monitoring",
      value: 1,
      subtitle: "Items to keep under watch",
      icon: <VisibilityIcon />,
      color: "info.main",
    },
    {
      id: 4,
      title: "Total Inventory",
      value: 11,
      subtitle: "Active inventory items",
      icon: <WarehouseIcon />,
      color: "success.main",
    },
  ];

	return (
		<Box sx={{ width: "100%" }}>
      <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
        Welcome to the dashboard, {user?.name}!
      </Typography>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: {
						xs: "1fr",
						sm: "repeat(1, 1fr)",
						md: "repeat(2, 1fr)",
						lg: "repeat(2, 1fr)",
						xl: "repeat(4, 1fr)",
					},
					gap: 2,
					width: "100%",
				}}
			>
				{dashboardCards.map((card) => (
					<Card
						key={card.id}
						sx={{
							height: "100%",
							display: "flex",
							flexDirection: "column",
							borderRadius: 3,
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
									sx={{ fontWeight: "bold", color: card.color, mb: 0.5 }}
								>
									{card.value}
								</Typography>
								<Typography
									variant="body2"
									color="text.secondary"
								>
									{card.subtitle}
								</Typography>
							</Box>
						</CardContent>
					</Card>
				))}
			</Box>
		</Box>
  );
};

export default Home;