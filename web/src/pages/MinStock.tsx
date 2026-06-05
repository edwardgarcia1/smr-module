import React, { useState } from "react";
import { Box, Paper, Tabs, Tab } from "@mui/material";
import CategoriesCard from "../components/min-stock/CategoriesCard";
import TabPanel from "../components/min-stock/TabPanel";
import PrincipalsTab from "../components/min-stock/PrincipalsTab";
import ItemsTab from "../components/min-stock/ItemsTab";

const MinStock: React.FC = () => {
	const [tab, setTab] = useState(0);

	return (
		<>
			<CategoriesCard />
			<Paper sx={{ width: "100%", borderRadius: 2, overflow: "hidden" }}>
				<Tabs
					value={tab}
					onChange={(_, newVal) => setTab(newVal)}
					sx={{
						borderBottom: 1,
						borderColor: "divider",
						px: 2,
						"& .MuiTab-root": { textTransform: "none", fontWeight: 600 },
					}}
				>
					<Tab label="Principals (Class-Level)" />
					<Tab label="Items (Per-Item)" />
				</Tabs>

				<Box sx={{ p: 2 }}>
					<TabPanel value={tab} index={0}>
						<PrincipalsTab />
					</TabPanel>
					<TabPanel value={tab} index={1}>
						<ItemsTab />
					</TabPanel>
				</Box>
			</Paper>
		</>
	);
};

export default MinStock;
