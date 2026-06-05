/**
 * DashboardLoadingSkeleton — Loading placeholder for the dashboard page.
 */
import React from "react";
import { Box, Card, CardHeader, CardContent, Skeleton } from "@mui/material";

const DashboardLoadingSkeleton: React.FC = () => (
	<Box sx={{ width: "100%" }}>
		<Skeleton variant="text" width={320} height={40} sx={{ mb: 3 }} />
		<Box
			sx={{
				display: "grid",
				gridTemplateColumns: {
					xs: "1fr",
					md: "repeat(2, 1fr)",
					xl: "repeat(3, 1fr)",
				},
				gap: 2,
				mb: 3,
			}}
		>
			{[1, 2, 3, 4].map((i) => (
				<Card key={i} sx={{ borderRadius: 3 }}>
					<CardHeader
						avatar={
							<Skeleton
								variant="rectangular"
								width={48}
								height={48}
								sx={{ borderRadius: 2 }}
							/>
						}
						title={<Skeleton variant="text" width="60%" />}
					/>
					<CardContent>
						<Skeleton variant="text" width="40%" height={48} />
						<Skeleton variant="text" width="70%" />
					</CardContent>
				</Card>
			))}
		</Box>
		<Box
			sx={{
				display: "grid",
				gridTemplateColumns: { xs: "1fr", md: "7fr 3fr" },
				gap: 2,
			}}
		>
			<Card sx={{ borderRadius: 3, height: 200 }}>
				<Skeleton
					variant="rectangular"
					sx={{ height: "100%", borderRadius: 3 }}
				/>
			</Card>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
				<Card sx={{ borderRadius: 3, height: 120 }}>
					<Skeleton
						variant="rectangular"
						sx={{ height: "100%", borderRadius: 3 }}
					/>
				</Card>
				<Card sx={{ borderRadius: 3, height: 120 }}>
					<Skeleton
						variant="rectangular"
						sx={{ height: "100%", borderRadius: 3 }}
					/>
				</Card>
			</Box>
		</Box>
	</Box>
);

export default DashboardLoadingSkeleton;
