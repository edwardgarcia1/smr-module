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

interface InventoryItem {
	id: number;
	description: string;
	code: string;
	supplier: string;
	currentLevel: number;
	inputUoM: string;
	priceClass: string;
}

const placeholderData: InventoryItem[] = [
	{
		id: 1,
		description: "BB - Zesto Fruit Soda Calamansi 330ml x 24cs",
		code: "ZES030",
		supplier: "ZESTO CORPORATION",
		currentLevel: 0.00,
		inputUoM: "cs",
		priceClass: "A",
	},
	{
		id: 2,
		description: "BB - Zesto Fruit Soda Calamansi 500ml x 12cs FG",
		code: "ZES039",
		supplier: "ZESTO CORPORATION",
		currentLevel: 0.00,
		inputUoM: "cs",
		priceClass: "B",
	},
	{
		id: 3,
		description: "BB - Zesto Grape Drink 330ml x 24cs",
		code: "ZES051",
		supplier: "ZESTO CORPORATION",
		currentLevel: 0.00,
		inputUoM: "cs",
		priceClass: "B",
	},
	{
		id: 4,
		description: "BB - Zesto Light Root Beer 330ml x 24cs",
		code: "ZES032",
		supplier: "ZESTO CORPORATION",
		currentLevel: 0.00,
		inputUoM: "cs",
		priceClass: "A",
	},
	{
		id: 5,
		description: "BB - Zesto Orange Juice 250ml x 24cs",
		code: "ZES045",
		supplier: "ZESTO CORPORATION",
		currentLevel: 0.00,
		inputUoM: "cs",
		priceClass: "A",
	},
	{
		id: 6,
		description: "BB - Zesto Root Beer 330ml x 24cs",
		code: "ZES033",
		supplier: "ZESTO CORPORATION",
		currentLevel: 0.00,
		inputUoM: "cs",
		priceClass: "A",
	},
	{
		id: 7,
		description: "Biogesic Paracetamol 500mg x 100s",
		code: "ZPC001",
		supplier: "ZUELLIG PHARMA CORPORATION",
		currentLevel: 0.00,
		inputUoM: "box",
		priceClass: "A",
	},
	{
		id: 8,
		description: "Decolgen Tablet x 20s",
		code: "ZPC003",
		supplier: "ZUELLIG PHARMA CORPORATION",
		currentLevel: 0.00,
		inputUoM: "box",
		priceClass: "B",
	},
	{
		id: 9,
		description: "Neozep Forte Tablet x 20s",
		code: "ZPC002",
		supplier: "ZUELLIG PHARMA CORPORATION",
		currentLevel: 0.00,
		inputUoM: "box",
		priceClass: "A",
	},
	{
		id: 10,
		description: "Prime Cooking Oil 1L x 12s",
		code: "PGC002",
		supplier: "PRIME GLOBAL CORPORATION",
		currentLevel: 0.00,
		inputUoM: "cs",
		priceClass: "A",
	},
	{
		id: 11,
		description: "Prime Rice Premium 25kg",
		code: "PGC001",
		supplier: "PRIME GLOBAL CORPORATION",
		currentLevel: 0.00,
		inputUoM: "sack",
		priceClass: "A",
	},
];

type Order = "asc" | "desc";
type OrderBy =
	| "id"
	| "description"
	| "code"
	| "supplier"
	| "currentLevel"
	| "inputUoM"
	| "priceClass";

const InventoryItems: React.FC = () => {
	const [items, setItems] = useState<InventoryItem[]>(placeholderData);
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
				item.description.toLowerCase().includes(query) ||
				item.code.toLowerCase().includes(query) ||
				item.supplier.toLowerCase().includes(query) ||
				item.currentLevel.toString().includes(query) ||
				item.inputUoM.toLowerCase().includes(query) ||
				item.priceClass.toLowerCase().includes(query)
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

	const getPriceClassColor = (priceClass: string) => {
		switch (priceClass.toUpperCase()) {
			case "A":
				return "success";
			case "B":
				return "info";
			case "C":
				return "warning";
			default:
				return "default";
		}
	};

	const headCells = [
		{ id: "select" as const, disablePadding: true, label: "" },
		{ id: "description" as const, disablePadding: false, label: "Description" },
		{ id: "code" as const, disablePadding: false, label: "Code" },
		{ id: "supplier" as const, disablePadding: false, label: "Supplier" },
		{ id: "currentLevel" as const, disablePadding: false, label: "Current Level" },
		{ id: "inputUoM" as const, disablePadding: false, label: "Input UoM" },
		{ id: "priceClass" as const, disablePadding: false, label: "Price Class" },
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
							placeholder="Search inventory items..."
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
														aria-label="select all inventory items"
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
													<Skeleton variant="text" width={120} />
												</TableCell>
												<TableCell>
													<Skeleton variant="text" width={80} />
												</TableCell>
												<TableCell>
													<Skeleton variant="text" width={60} />
												</TableCell>
												<TableCell>
													<Skeleton variant="text" width={60} />
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
														{item.description}
													</TableCell>
													<TableCell>{item.code}</TableCell>
													<TableCell>{item.supplier}</TableCell>
													<TableCell>
														{item.currentLevel.toLocaleString()}
													</TableCell>
													<TableCell>{item.inputUoM}</TableCell>
													<TableCell>
														<Chip
															label={item.priceClass.toUpperCase()}
															color={getPriceClassColor(item.priceClass)}
															size="small"
														/>
													</TableCell>
												</TableRow>
											);
										})}
								{!loading && emptyRows > 0 && (
									<TableRow style={{ height: 53 * emptyRows }}>
										<TableCell colSpan={7} />
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

export default InventoryItems;
