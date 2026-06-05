import React from "react";
import RequirementsToolbarBase from "./RequirementsToolbarBase";

interface BundlingToolbarProps {
	handleExcelExport: () => void;
	darkMode: boolean;
	selectedCategories: string[];
	setSelectedCategories: (val: string[]) => void;
}

const BundlingToolbar: React.FC<BundlingToolbarProps> = (props) => (
	<RequirementsToolbarBase title="Promo Products — Bundling Analysis" {...props} />
);

export default BundlingToolbar;
