import React, { useState, useMemo } from "react";
import {
	Box,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Paper,
	Chip,
	TablePagination,
	Checkbox,
	TableSortLabel,
	Skeleton,
	Alert,
	TextField,
	InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

interface PurchasingRequirement {
	id: number;
	supplier: string;
	itemCount: number;
	status: string;
	priority: string;
	createdAt: string;
}

const placeholderData: PurchasingRequirement[] = [
	{
		id: 1,
		supplier: "ZESTO CORPORATION",
		itemCount: 5,
		status: "urgent",
		priority: "high",
		createdAt: "2024-01-15",
	},
	{
		id: 2,
		supplier: "ZUELLIG PHARMA CORPORATION",
		itemCount: 3,
		status: "secondary",
		priority: "medium",
		createdAt: "2024-01-14",
	},
	{
		id: 3,
		supplier: "PRIME GLOBAL CORPORATION",
		itemCount: 2,
		status: "monitor",
		priority: "low",
		createdAt: "2024-01-13",
	},
	{
		id: 4,
		supplier: "MULTIRICH FOODS CORPORATION",
		itemCount: 4,
		status: "urgent",
		priority: "high",
		createdAt: "2024-01-12",
	},
	{
		id: 5,
		supplier: "W.L. FOOD PRODUCTS",
		itemCount: 1,
		status: "secondary",
		priority: "medium",
		createdAt: "2024-01-11",
	},
];

type Order = "asc" | "desc";
type OrderBy = "id" | "supplier" | "itemCount" | "status" | "priority" | "createdAt";

const PurchasingRequirements: React.FC = () => {
	const [items, setItems] = useState<PurchasingRequirement[]>(placeholderData);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);
	const [order, setOrder] = useState<Order>("asc");
	const [orderBy, setOrderBy] = useState<OrderBy>("id");
	const [selected, setSelected] = useState<readonly number[]>([]);
	const [searchQuery, setSearchQuery] = useState("");

	const handleRequestSort = (property: OrderBy) => {
		const isAsc = orderBy === property && order === "asc";
		setOrder(isAsc ? "desc" : "asc");
		setOrderBy(property);
	};

	const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (event.target.checked) {
			const newSelecteds = items.map((n) => n.id);
			setSelected(newSelecteds);
			return;
		}
		setSelected([]);
	};

	const handleClick = (_event: React.MouseEvent<unknown>, id: number) => {
		const selectedIndex = selected.indexOf(id);
		let newSelected: readonly number[] = [];

		if (selectedIndex === -1) {
			newSelected = newSelected.concat(selected, id);
		} else if (selectedIndex === 0) {
			newSelected = newSelected.concat(selected.slice(1));
		} else if (selectedIndex === selected.length - 1) {
			newSelected = newSelected.concat(selected.slice(0, -1));
		} else if (selectedIndex > 0) {
			newSelected = newSelected.concat(
				selected.slice(0, selectedIndex),
				selected.slice(selectedIndex + 1),
			);
		}

		setSelected(newSelected);
	};

	const handleChangePage = (_event: unknown, newPage: number) => {
		setPage(newPage);
	};

	const handleChangeRowsPerPage = (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		setRowsPerPage(parseInt(event.target.value, 10));
		setPage(0);
	};

	const isSelected = (id: number) => selected.indexOf(id) !== -1;

	const emptyRows =
		page > 0 ? Math.max(0, (1 + page) * rowsPerPage - items.length) : 0;

	const filteredItems = useMemo(() => {
		if (!searchQuery.trim()) return items;

		const query = searchQuery.toLowerCase().trim();

		return items.filter((item) => {
			return (
				item.id.toString().includes(query) ||
				item.supplier.toLowerCase().includes(query) ||
				item.status.toLowerCase().includes(query) ||
				item.priority.toLowerCase().includes(query) ||
				item.createdAt.includes(query)
			);
		});
	}, [items, searchQuery]);

	const sortedItems = useMemo(() => {
		return [...filteredItems].sort((a, b) => {
			const aValue = a[orderBy];
			const bValue = b[orderBy];

			// Normalize strings to lowercase for case-insensitive sorting
			const aStr = typeof aValue === "string" ? aValue.toLowerCase() : aValue;
			const bStr = typeof bValue === "string" ? bValue.toLowerCase() : bValue;

			if (aStr < bStr) {
				return order === "asc" ? -1 : 1;
			}
			if (aStr > bStr) {
				return order === "asc" ? 1 : -1;
			}
			return 0;
		});
	}, [filteredItems, order, orderBy]);

	const paginatedItems = sortedItems.slice(
		page * rowsPerPage,
		page * rowsPerPage + rowsPerPage,
	);

	const getStatusColor = (status: string) => {
		switch (status.toLowerCase()) {
			case "urgent":
				return "error";
			case "secondary":
				return "warning";
			case "monitor":
				return "info";
			default:
				return "default";
		}
	};

	const getPriorityColor = (priority: string) => {
		switch (priority.toLowerCase()) {
			case "high":
				return "error";
			case "medium":
				return "warning";
			case "low":
				return "success";
			default:
				return "default";
		}
	};

	const headCells = [
		{ id: "select" as const, disablePadding: true, label: "" },
		{ id: "supplier" as const, disablePadding: false, label: "Supplier" },
		{ id: "itemCount" as const, disablePadding: false, label: "Item Count" },
		{ id: "status" as const, disablePadding: false, label: "Status" },
		{ id: "priority" as const, disablePadding: false, label: "Priority" },
		{ id: "createdAt" as const, disablePadding: false, label: "Created At" },
	];

	return (
		<>
			{error ? (
				<Alert severity="error" sx={{ mb: 2 }}>
					{error}
				</Alert>
			) : (
				<Paper sx={{ width: "100%", mb: 2 }}>
					<Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
						<TextField
							fullWidth
							variant="outlined"
							placeholder="Search purchasing requirements..."
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
									height: 44,
								},
								"& .MuiInputBase-input": {
									paddingY: 0,
								},
							}}
						/>
					</Box>
					<TableContainer sx={{ maxHeight: 440 }}>
						<Table stickyHeader aria-labelledby="tableTitle">
							<TableHead>
								<TableRow>
									{headCells.map((headCell) => (
										<TableCell
											key={headCell.id}
											padding={headCell.disablePadding ? "none" : "normal"}
											sortDirection={orderBy === headCell.id ? order : false}
											sx={{ bgcolor: "var(--sidebar-bg)", color: "var(--sidebar-text)" }}
										>
											{headCell.id === "select" ? (
												loading ? (
													<Skeleton
														variant="rectangular"
														width={24}
														height={24}
														sx={{ mx: 1 }}
													/>
												) : (
													<Checkbox
														indeterminate={
															selected.length > 0 &&
															selected.length < items.length
														}
														checked={
															items.length > 0 &&
															selected.length === items.length
														}
														onChange={handleSelectAllClick}
														aria-label="select all requirements"
														sx={{
															color: "var(--sidebar-text)",
															"&.Mui-checked": { color: "var(--sidebar-text)" },
															"&.MuiCheckbox-indeterminate": { color: "var(--sidebar-text)" },
															"&.MuiCheckbox-root": { color: "var(--sidebar-text)" },
														}}
													/>
												)
											) : (
												<TableSortLabel
													active={orderBy === headCell.id}
													direction={orderBy === headCell.id ? order : "asc"}
													onClick={() => handleRequestSort(headCell.id)}
													sx={{
														"&.MuiTableSortLabel-active": { color: "var(--sidebar-text) !important" },
														"& .MuiTableSortLabel-icon": { color: "var(--sidebar-text) !important" },
														color: "var(--sidebar-text)",
													}}
												>
													{headCell.label}
												</TableSortLabel>
											)}
										</TableCell>
									))}
								</TableRow>
							</TableHead>
							<TableBody>
								{loading
									? [...Array(rowsPerPage)].map((_, index) => (
											<TableRow key={`skeleton-${index}`}>
												<TableCell padding="none">
													<Skeleton
														variant="rectangular"
														width={24}
														height={24}
														sx={{ mx: 1 }}
													/>
												</TableCell>
												<TableCell>
													<Skeleton variant="text" width={150} />
												</TableCell>
												<TableCell>
													<Skeleton variant="text" width={80} />
												</TableCell>
												<TableCell>
													<Skeleton variant="text" width={80} />
												</TableCell>
												<TableCell>
													<Skeleton variant="text" width={80} />
												</TableCell>
												<TableCell>
													<Skeleton variant="text" width={100} />
												</TableCell>
											</TableRow>
										))
									: paginatedItems.map((item, index) => {
											const isItemSelected = isSelected(item.id);
											const labelId = `enhanced-table-checkbox-${index}`;
											return (
												<TableRow
													hover
													onClick={(event) => handleClick(event, item.id)}
													role="checkbox"
													aria-checked={isItemSelected}
													tabIndex={-1}
													key={item.id}
													selected={isItemSelected}
													sx={{ cursor: "pointer" }}
												>
													<TableCell padding="none">
														<Checkbox
															color="primary"
															checked={isItemSelected}
															aria-labelledby={labelId}
														/>
													</TableCell>
													<TableCell
														component="th"
														id={labelId}
														scope="row"
														padding="none"
													>
														{item.supplier}
													</TableCell>
													<TableCell>{item.itemCount}</TableCell>
													<TableCell>
														<Chip
															label={item.status.toUpperCase()}
															color={getStatusColor(item.status)}
															size="small"
														/>
													</TableCell>
													<TableCell>
														<Chip
															label={item.priority.toUpperCase()}
															color={getPriorityColor(item.priority)}
															size="small"
														/>
													</TableCell>
													<TableCell>{item.createdAt}</TableCell>
												</TableRow>
											);
										})}
								{!loading && emptyRows > 0 && (
									<TableRow style={{ height: 53 * emptyRows }}>
										<TableCell colSpan={6} />
									</TableRow>
								)}
							</TableBody>
						</Table>
					</TableContainer>
					<TablePagination
						component="div"
						count={items.length}
						rowsPerPage={rowsPerPage}
						page={page}
						onPageChange={handleChangePage}
						onRowsPerPageChange={handleChangeRowsPerPage}
						labelRowsPerPage="Rows:"
						sx={{
							width: "100%",
							display: "flex",
							flexDirection: { xs: "column", sm: "row" },
							alignItems: "center",
							gap: 1,
							"& .MuiTablePagination-toolbar": {
								flexWrap: "wrap",
								justifyContent: { xs: "center", sm: "flex-end" },
							},
							"& .MuiTablePagination-spacer": {
								display: "none",
							},
						}}
					/>
				</Paper>
			)}
		</>
	);
};

export default PurchasingRequirements;
