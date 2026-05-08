import React, { useState, useMemo, useEffect, useCallback } from "react";
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
	Skeleton,
	Alert,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import DescriptionIcon from "@mui/icons-material/Description";
import apiRequest from "../services/api";

interface Principal {
	ClassID: string;
	Descr: string;
	User5: string | null;
	VendId: string | null;
	VendorAddr1: string | null;
	VendorAddr2: string | null;
	VendorCity: string | null;
	VendorTerms: string | null;
}

const EMPTY = "—";

const displayValue = (val: string | null | undefined): string => {
	if (!val || val.trim() === "") return EMPTY;
	return val;
};

const Principals: React.FC = () => {
	const [searchQuery, setSearchQuery] = useState("");
	const [principals, setPrincipals] = useState<Principal[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchPrincipals = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await apiRequest<Principal[]>("/principal");
			setPrincipals(data);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load principals",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchPrincipals();
	}, [fetchPrincipals]);

	const filteredPrincipals = useMemo(() => {
		if (!searchQuery.trim()) return principals;

		const query = searchQuery.toLowerCase().trim();

		return principals.filter((p) => {
			return (
				p.ClassID.toLowerCase().includes(query) ||
				p.Descr.toLowerCase().includes(query) ||
				(p.User5 && p.User5.toLowerCase().includes(query)) ||
				(p.VendId && p.VendId.toLowerCase().includes(query)) ||
				(p.VendorAddr1 && p.VendorAddr1.toLowerCase().includes(query)) ||
				(p.VendorAddr2 && p.VendorAddr2.toLowerCase().includes(query)) ||
				(p.VendorCity && p.VendorCity.toLowerCase().includes(query)) ||
				(p.VendorTerms && p.VendorTerms.toLowerCase().includes(query))
			);
		});
	}, [searchQuery, principals]);

	if (loading) {
		return (
			<Box sx={{ width: "100%" }}>
				<Box sx={{ mb: 3 }}>
					<Skeleton variant="rectangular" height={40} sx={{ borderRadius: 2 }} />
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
					}}
				>
					{[...Array(6)].map((_, i) => (
						<Card key={i} sx={{ borderRadius: 3 }}>
							<CardHeader
								avatar={
									<Skeleton variant="rectangular" width={48} height={48} sx={{ borderRadius: 2 }} />
								}
								title={<Skeleton variant="text" width="70%" />}
								subheader={<Skeleton variant="text" width="40%" />}
							/>
							<CardContent>
								<Skeleton variant="text" width="90%" />
								<Skeleton variant="text" width="60%" />
								<Skeleton variant="text" width="50%" />
							</CardContent>
						</Card>
					))}
				</Box>
			</Box>
		);
	}

	if (error) {
		return (
			<Alert
				severity="error"
				action={
					<Chip
						label="Retry"
						size="small"
						clickable
						color="error"
						variant="outlined"
						onClick={fetchPrincipals}
					/>
				}
			>
				{error}
			</Alert>
		);
	}

	return (
		<Box sx={{ width: "100%" }}>
			<Box sx={{ mb: 3 }}>
				<TextField
					fullWidth
					variant="outlined"
					placeholder="Search principals..."
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
				{filteredPrincipals.map((principal) => {
					const initials = principal.ClassID.slice(0, 2);
					const hasVendor =
						principal.VendId &&
						principal.VendId.trim() !== "" &&
						principal.User5 &&
						principal.User5.trim() !== "";

					return (
						<Card
							key={principal.ClassID}
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
										aria-label={principal.Descr}
									>
										{initials}
									</Avatar>
								}
								title={
									<Typography
										variant="h6"
										component="div"
										sx={{ fontSize: "1rem", lineHeight: 1.3 }}
									>
										{principal.Descr}
									</Typography>
								}
								subheader={
									<Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
										<Chip
											label={principal.ClassID}
											size="small"
											color="primary"
											variant="outlined"
											sx={{ fontSize: "0.7rem", height: 20 }}
										/>
										{hasVendor && (
											<Chip
												label={`ID: ${principal.VendId}`}
												size="small"
												variant="outlined"
												color="secondary"
												sx={{ fontSize: "0.7rem", height: 20 }}
											/>
										)}
									</Box>
								}
								sx={{ pb: 0 }}
							/>
							<CardContent sx={{ pt: 1, flexGrow: 1 }}>
								<Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
									{/* Address block */}
									<Box sx={{ display: "flex", gap: 0.5 }}>
										<LocationOnIcon
											sx={{
												fontSize: 14,
												color: "text.secondary",
												mt: 0.3,
												flexShrink: 0,
											}}
										/>
										<Box>
											<Typography variant="caption" color="text.secondary">
												{displayValue(principal.VendorAddr1)}
											</Typography>
											{(principal.VendorAddr2 && principal.VendorAddr2.trim()) ||
											(principal.VendorCity && principal.VendorCity.trim()) ? (
												<Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
													{principal.VendorAddr2 && principal.VendorAddr2.trim()
														? principal.VendorAddr2
														: ""}
													{principal.VendorAddr2 &&
													principal.VendorAddr2.trim() &&
													principal.VendorCity &&
													principal.VendorCity.trim()
														? ", "
														: ""}
													{principal.VendorCity && principal.VendorCity.trim()
														? principal.VendorCity
														: ""}
												</Typography>
											) : null}
										</Box>
									</Box>

									{/* Terms block */}
									<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
										<DescriptionIcon
											sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }}
										/>
										<Typography variant="caption" color="text.secondary">
											Terms:{" "}
											{principal.VendorTerms && principal.VendorTerms.trim()
												? principal.VendorTerms
												: EMPTY}
										</Typography>
									</Box>
								</Box>
							</CardContent>
						</Card>
					);
				})}
				{filteredPrincipals.length === 0 && (
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
							No principals found matching "{searchQuery}"
						</Typography>
					</Box>
				)}
			</Box>
		</Box>
	);
};

export default Principals;
