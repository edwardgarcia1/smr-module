import type { GroupColors } from "../../config/requirements";

type CssProp = string | number | Record<string, unknown>;

/**
 * Build the shared DataGrid sx prop for both purchasing and bundling grids.
 * Eliminates the ~150 line duplication between the two DataGrid instances.
 */
export function buildBaseGridSx(
	darkMode: boolean,
	groupColors: GroupColors,
	extraGroupSelectors?: Record<string, Record<string, CssProp>>,
): Record<string, CssProp> {
	return {
		height: "100%",
		"& .MuiDataGrid-columnHeader": {
			fontWeight: 600,
			fontSize: "0.8rem",
		},
		"& .MuiDataGrid-columnHeaders": {
			borderBottom: 2,
			borderColor: "divider",
		},
		"& .MuiDataGrid-columnHeader--filledGroup .MuiDataGrid-columnHeaderTitleContainer": {
			justifyContent: "center",
		},
		"& .MuiDataGrid-columnHeader--filledGroup .MuiDataGrid-columnHeaderTitle": {
			textAlign: "center",
		},
		// Common group styles
		"& .group-demand": {
			backgroundColor: groupColors.demand.bg,
			color: groupColors.demand.color,
		},
		"& .group-computation": {
			backgroundColor: groupColors.computation.bg,
			color: groupColors.computation.color,
		},
		"& .group-inventory": {
			backgroundColor: groupColors.inventory.bg,
			color: groupColors.inventory.color,
		},
		// Row class styles
		"& .row-immediate": {
			backgroundColor: darkMode ? "rgba(211, 47, 47, 0.35)" : "#ffcdd2",
			borderLeft: "5px solid #d32f2f",
		},
		"& .row-secondary": {
			backgroundColor: darkMode ? "rgba(255, 193, 7, 0.30)" : "#fff9c4",
			borderLeft: "5px solid #f9a825",
		},
		"& .row-monitoring": {
			backgroundColor: darkMode ? "rgba(33, 150, 243, 0.27)" : "#bbdefb",
			borderLeft: "5px solid #1976d2",
		},
		"& .row-overstocked": {
			backgroundColor: darkMode ? "rgba(76, 175, 80, 0.27)" : "#c8e6c9",
			borderLeft: "5px solid #388e3c",
		},
		"& .row-ordered": {
			backgroundColor: darkMode ? "rgba(156, 39, 176, 0.25)" : "#e1bee7",
			borderLeft: "5px solid #7b1fa2",
		},
		"& .row-no-record": {
			backgroundColor: darkMode ? "rgba(158, 158, 158, 0.25)" : "#eceff1",
			borderLeft: "5px solid #616161",
		},
		"& .MuiDataGrid-cell:focus": { outline: "none" },
		"& .MuiDataGrid-cell:focus-within": { outline: "none" },
		"& .MuiDataGrid-footerContainer": {
			borderTop: "1px solid",
			borderColor: "divider",
		},
		"& .MuiDataGrid-virtualScroller": { minHeight: 300 },
		// Extra group selectors (passed in for mode-specific groups)
		...(extraGroupSelectors ?? {}),
	};
}

/**
 * Extra group selectors for the purchasing grid.
 */
export function purchasingGroupSelectors(
	groupColors: GroupColors,
): Record<string, Record<string, CssProp>> {
	return {
		"& .group-price": {
			backgroundColor: groupColors.price.bg,
			color: groupColors.price.color,
		},
		"& .group-stock": {
			backgroundColor: groupColors.stock.bg,
			color: groupColors.stock.color,
		},
		"& .group-final-order": {
			backgroundColor: groupColors.finalOrder.bg,
			color: groupColors.finalOrder.color,
		},
	};
}

/**
 * Extra group selectors for the bundling grid.
 */
export function bundlingGroupSelectors(
	groupColors: GroupColors,
): Record<string, Record<string, CssProp>> {
	return {
		"& .group-bundling": {
			backgroundColor: groupColors.bundling.bg,
			color: groupColors.bundling.color,
		},
		"& .group-component": {
			backgroundColor: groupColors.component.bg,
			color: groupColors.component.color,
		},
	};
}
