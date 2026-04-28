import React from 'react';
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
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import VisibilityIcon from "@mui/icons-material/Visibility";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import EmailIcon from "@mui/icons-material/Email";
import { useAuthStore } from '../store/useAuthStore';
import { Link } from "react-router-dom";

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
      path: "/purchasing-requirements?filter=urgent",
    },
    {
      id: 2,
      title: "Secondary Purchase",
      value: 4,
      subtitle: "Items approaching reorder point",
      icon: <Inventory2Icon />,
      color: "warning.main",
      path: "/purchasing-requirements?filter=secondary",
    },
    {
      id: 3,
      title: "Monitoring",
      value: 1,
      subtitle: "Items to keep under watch",
      icon: <VisibilityIcon />,
      color: "info.main",
      path: "/purchasing-requirements?filter=monitor",
    },
    {
      id: 4,
      title: "Total Inventory",
      value: 11,
      subtitle: "Active inventory items",
      icon: <WarehouseIcon />,
      color: "success.main",
      path: "/inventory-items",
    },
  ];

  const purchaseRequirementsData = [
    {
      id: 1,
      initials: "PG",
      companyName: "PRIME GLOBAL CORPORATION",
      items: 2,
      statuses: [{ type: "secondary", count: 1 }],
    },
    {
      id: 2,
      initials: "ZE",
      companyName: "ZESTO CORPORATION",
      items: 6,
      statuses: [
        { type: "urgent", count: 5 },
        { type: "secondary", count: 1 },
      ],
    },
    {
      id: 3,
      initials: "ZP",
      companyName: "ZUELLIG PHARMA CORPORATION",
      items: 3,
      statuses: [
        { type: "secondary", count: 2 },
        { type: "monitor", count: 1 },
      ],
    },
  ];

  const quickStatsData = [
    { label: "Active Suppliers", value: "8" },
    { label: "Inventory Items", value: "11" },
    { label: "Draft POs", value: "1" },
    { label: "Monthly Factor", value: "1.5×" },
  ];

  const quickActionsData = [
    { label: "Open SMR View", path: "/purchasing-requirements" },
    { label: "Manage Inventory", path: "/inventory-items" },
    { label: "Purchase Orders", path: "/purchase-orders" },
  ];

  const getStatusColor = (type: string) => {
    switch (type) {
      case "urgent":
        return "error.main";
      case "secondary":
        return "warning.main";
      case "monitor":
        return "info.main";
      default:
        return "text.secondary";
    }
  };

	return (
		<Box sx={{ width: "100%" }}>
      <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
        Welcome to the dashboard, {user?.name}!
      </Typography>
      
      {/* Dashboard Cards Row */}
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
          mb: 3,
				}}
			>
      {dashboardCards.map((card) => (
        <Link
          key={card.id}
          to={card.path}
          style={{ textDecoration: "none" }}
        >
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
        </Link>
      ))}
			</Box>

      {/* Bottom Section Row: 70% + 30% split */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "7fr 3fr" },
          gap: 2,
          width: "100%",
        }}
      >
        {/* Left: Purchase Requirements by Supplier (70%) */}
        <Card sx={{ borderRadius: 3, height: "100%" }}>
          <CardHeader
            title="Purchase Requirements by Supplier"
            action={
              <Button
                size="small"
                component={Link}
                to="/purchasing-requirements"
                sx={{ textTransform: "none" }}
              >
                View All
              </Button>
            }
            sx={{ pb: 0 }}
          />
          <CardContent sx={{ pt: 1 }}>
            {purchaseRequirementsData.map((req, index) => (
              <Box key={req.id}>
                {index > 0 && <Divider sx={{ my: 1.5 }} />}
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
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
                    {req.initials}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                      {req.companyName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {req.items} items
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    {req.statuses.map((status, sIndex) => (
                      <Box
                        key={sIndex}
                        sx={{
                          bgcolor: getStatusColor(status.type),
                          color: "white",
                          px: 1,
                          py: 0.5,
                          borderRadius: 2,
                          fontSize: "0.75rem",
                        }}
                      >
                        {status.count} {status.type}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            ))}
          </CardContent>
        </Card>

        {/* Right: 30% Split Vertically */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Quick Stats */}
          <Card sx={{ borderRadius: 3, flexGrow: 1 }}>
            <CardHeader title="Quick Stats" sx={{ pb: 0 }} />
            <CardContent sx={{ pt: 1 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                {quickStatsData.map((stat, index) => (
                  <Box key={index} sx={{ textAlign: "center", py: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: "bold", color: "primary.main" }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {stat.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card sx={{ borderRadius: 3, flexGrow: 1 }}>
            <CardHeader title="Quick Actions" sx={{ pb: 0 }} />
            <CardContent sx={{ pt: 1 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {quickActionsData.map((action, index) => (
                  <Button
                    key={index}
                    component={Link}
                    to={action.path}
                    variant="outlined"
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
        </Box>
      </Box>
		</Box>
  );
};

export default Home;