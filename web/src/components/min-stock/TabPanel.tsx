/**
 * TabPanel — Generic tab panel wrapper for tab content.
 */
import React from "react";
import { Box } from "@mui/material";

interface TabPanelProps {
	children: React.ReactNode;
	value: number;
	index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
	<Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
		{value === index && children}
	</Box>
);

export default TabPanel;
