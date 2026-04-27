import React, { useState, useMemo } from "react";
import {
	Box,
	Card,
	CardHeader,
	CardContent,
	Avatar,
	Typography,
	Chip,
	TextField,
	InputAdornment,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import SearchIcon from "@mui/icons-material/Search";

interface Supplier {
	id: number;
	initials: string;
	companyName: string;
	code: string;
	contactName: string;
	email: string;
}

const placeholderData: Supplier[] = [
	{
		id: 1,
		initials: "JI",
		companyName: "JIA2 CORPORATION",
		code: "JIA",
		contactName: "Jia Li",
		email: "orders@jia2.com",
	},
	{
		id: 2,
		initials: "MF",
		companyName: "MULTIRICH FOODS CORPORATION",
		code: "MFC",
		contactName: "Rico Tan",
		email: "orders@multirich.com",
	},
	{
		id: 3,
		initials: "PG",
		companyName: "PRIME GLOBAL CORPORATION",
		code: "PGC",
		contactName: "Alex Prime",
		email: "orders@primeglobal.com",
	},
	{
		id: 4,
		initials: "WL",
		companyName: "W.L. FOOD PRODUCTS",
		code: "WLF",
		contactName: "Mary Wong",
		email: "orders@wlfood.com",
	},
	{
		id: 5,
		initials: "WE",
		companyName: "WEIZ CORP",
		code: "WEI",
		contactName: "Bob Wei",
		email: "orders@weiz.com",
	},
	{
		id: 6,
		initials: "WL",
		companyName: "WINE AND LIQUOR BOULEVARD INC",
		code: "WLB",
		contactName: "Carlos Vino",
		email: "orders@wineliquor.com",
	},
	{
		id: 7,
		initials: "ZE",
		companyName: "ZESTO CORPORATION",
		code: "ZES",
		contactName: "Jane Smith",
		email: "orders@zesto.com",
	},
	{
		id: 8,
		initials: "ZP",
		companyName: "ZUELLIG PHARMA CORPORATION",
		code: "ZPC",
		contactName: "John Doe",
		email: "orders@zuellig.com",
	},
];

const Suppliers: React.FC = () => {
	const [searchQuery, setSearchQuery] = useState("");

	const filteredSuppliers = useMemo(() => {
		if (!searchQuery.trim()) return placeholderData;

		const query = searchQuery.toLowerCase().trim();

		return placeholderData.filter((supplier) => {
			return (
				supplier.id.toString().includes(query) ||
				supplier.initials.toLowerCase().includes(query) ||
				supplier.companyName.toLowerCase().includes(query) ||
				supplier.code.toLowerCase().includes(query) ||
				supplier.contactName.toLowerCase().includes(query) ||
				supplier.email.toLowerCase().includes(query)
			);
		});
	}, [searchQuery]);

	return (
		<Box sx={{ width: "100%" }}>
			<Box sx={{ mb: 3 }}>
				<TextField
					fullWidth
					variant="outlined"
					placeholder="Search suppliers..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					slotProps={{
						input: {
							startAdornment: (
								<InputAdornment position="start">
									<SearchIcon />
								</InputAdornment>
							),
						},
					}}
					sx={{
						"& .MuiOutlinedInput-root": {
							borderRadius: 2,
							height: 40,
						},
						"& .MuiInputBase-input": {
							paddingY: 0,
						},
					}}
				/>
			</Box>
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
				}}
			>
				{filteredSuppliers.map((supplier) => (
					<Card
						key={supplier.id}
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
										bgcolor: "primary.main",
										width: 48,
										height: 48,
										fontSize: "0.9rem",
										fontWeight: "bold",
										borderRadius: 2,
									}}
									aria-label={supplier.companyName}
								>
									{supplier.initials}
								</Avatar>
							}
							title={
								<Typography
									variant="h6"
									component="div"
									sx={{ fontSize: "1rem" }}
								>
									{supplier.companyName}
								</Typography>
							}
							subheader={
								<Chip
									label={supplier.code}
									size="small"
									sx={{
										fontSize: "0.7rem",
										height: 20,
										mt: 0.5,
									}}
								/>
							}
							sx={{ pb: 0 }}
						/>
						<CardContent sx={{ pt: 1, flexGrow: 1 }}>
							<Box sx={{ mt: 1 }}>
								<Typography
									variant="body2"
									sx={{ fontWeight: "medium", mb: 0.5 }}
								>
									{supplier.contactName}
								</Typography>
								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										gap: 0.5,
										mt: 0.5,
									}}
								>
									<EmailIcon sx={{ fontSize: 14, color: "text.secondary" }} />
									<Typography variant="caption" color="text.secondary">
										{supplier.email}
									</Typography>
								</Box>
							</Box>
						</CardContent>
					</Card>
				))}
				{filteredSuppliers.length === 0 && (
					<Box
						sx={{
							gridColumn: "1 / -1",
							display: "flex",
							justifyContent: "center",
							alignItems: "center",
							py: 6,
							color: "text.secondary",
						}}
					>
						<Typography variant="body1">
							No suppliers found matching "{searchQuery}"
						</Typography>
					</Box>
				)}
			</Box>
		</Box>
	);
};

export default Suppliers;
