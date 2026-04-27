import React, { useMemo, useState } from "react";
import {
	Box,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Paper,
	Alert,
	TablePagination,
	Checkbox,
	TableSortLabel,
	Chip,
	TextField,
	InputAdornment,
} from "@mui/material";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import CancelIcon from "@mui/icons-material/Cancel";
import SearchIcon from "@mui/icons-material/Search";

interface PurchaseOrder {
	id: number;
	seriesNbr: string;
	poRefNbr: string;
	supplier: string;
	status: string;
	periodFrom: Date;
	periodTo: Date;
	created: Date;
}

type Order = "asc" | "desc";
type OrderBy = "id" | "seriesNbr" | "poRefNbr" | "supplier" | "status" | "periodFrom" | "periodTo" | "created";

const formatDate = (date: Date): string => {
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
};

const getStatusChip = (status: string) => {
	switch (status.toLowerCase()) {
		case "pending":
			return (
				<Chip
					icon={<HourglassEmptyIcon />}
					label={status}
					color="warning"
					size="small"
					sx={{ borderRadius: 2 }}
				/>
			);
		case "approved":
			return (
				<Chip
					icon={<CheckCircleIcon />}
					label={status}
					color="success"
					size="small"
					sx={{ borderRadius: 2 }}
				/>
			);
		case "completed":
			return (
				<Chip
					icon={<DoneAllIcon />}
					label={status}
					color="info"
					size="small"
					sx={{ borderRadius: 2 }}
				/>
			);
		case "cancelled":
			return (
				<Chip
					icon={<CancelIcon />}
					label={status}
					color="error"
					size="small"
					sx={{ borderRadius: 2 }}
				/>
			);
		default:
			return (
				<Chip
					label={status}
					color="default"
					size="small"
					sx={{ borderRadius: 2 }}
				/>
			);
	}
};

const PurchaseOrders: React.FC = () => {
	// Placeholder data
	const placeholderData: PurchaseOrder[] = [
		{
			id: 1,
			seriesNbr: "PO-2024-001",
			poRefNbr: "REF-001",
			supplier: "Acme Corp",
			status: "Pending",
			periodFrom: new Date("2024-01-01"),
			periodTo: new Date("2024-01-31"),
			created: new Date("2024-01-05"),
		},
		{
			id: 2,
			seriesNbr: "PO-2024-002",
			poRefNbr: "REF-002",
			supplier: "Globex Inc",
			status: "Approved",
			periodFrom: new Date("2024-02-01"),
			periodTo: new Date("2024-02-28"),
			created: new Date("2024-02-10"),
		},
		{
			id: 3,
			seriesNbr: "PO-2024-003",
			poRefNbr: "REF-003",
			supplier: "Soylent Corp",
			status: "Completed",
			periodFrom: new Date("2024-03-01"),
			periodTo: new Date("2024-03-31"),
			created: new Date("2024-03-05"),
		},
		{
			id: 4,
			seriesNbr: "PO-2024-004",
			poRefNbr: "REF-004",
			supplier: "Initech",
			status: "Cancelled",
			periodFrom: new Date("2024-04-01"),
			periodTo: new Date("2024-04-30"),
			created: new Date("2024-04-12"),
		},
	];

	const [orders, setOrders] = useState<PurchaseOrder[]>(placeholderData);
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
			const newSelecteds = orders.map((n) => n.id);
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

	const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
		setRowsPerPage(parseInt(event.target.value, 10));
		setPage(0);
	};

	const isSelected = (id: number) => selected.indexOf(id) !== -1;

	const filteredOrders = useMemo(() => {
		if (!searchQuery.trim()) return orders;

		const query = searchQuery.toLowerCase().trim();

		return orders.filter((order) => {
			const formattedPeriodFrom = formatDate(order.periodFrom).toLowerCase();
			const formattedPeriodTo = formatDate(order.periodTo).toLowerCase();
			const formattedCreated = formatDate(order.created).toLowerCase();

			return (
				order.id.toString().includes(query) ||
				order.seriesNbr.toLowerCase().includes(query) ||
				order.poRefNbr.toLowerCase().includes(query) ||
				order.supplier.toLowerCase().includes(query) ||
				order.status.toLowerCase().includes(query) ||
				formattedPeriodFrom.includes(query) ||
				formattedPeriodTo.includes(query) ||
				formattedCreated.includes(query)
			);
		});
	}, [orders, searchQuery]);

	const sortedOrders = useMemo(() => {
		return [...filteredOrders].sort((a, b) => {
			const aValue = a[orderBy];
			const bValue = b[orderBy];

			let comparison = 0;
			if (aValue instanceof Date && bValue instanceof Date) {
				comparison = aValue.getTime() - bValue.getTime();
			} else if (typeof aValue === "string" && typeof bValue === "string") {
				comparison = aValue.localeCompare(bValue);
			} else {
				comparison = aValue < bValue ? -1 : 1;
			}

			return order === "asc" ? comparison : -comparison;
		});
	}, [filteredOrders, order, orderBy]);

	const paginatedOrders = sortedOrders.slice(
		page * rowsPerPage,
		page * rowsPerPage + rowsPerPage,
	);

	const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - orders.length) : 0;

	const headCells = [
		{ id: "select" as const, disablePadding: true, label: "" },
		{ id: "seriesNbr" as const, disablePadding: false, label: "Series Nbr" },
		{ id: "poRefNbr" as const, disablePadding: false, label: "PO Ref Nbr" },
		{ id: "supplier" as const, disablePadding: false, label: "Supplier" },
		{ id: "status" as const, disablePadding: false, label: "Status" },
		{ id: "periodFrom" as const, disablePadding: false, label: "Period From" },
		{ id: "periodTo" as const, disablePadding: false, label: "Period To" },
		{ id: "created" as const, disablePadding: false, label: "Created" },
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
							placeholder="Search purchase orders..."
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
										>
											{headCell.id === "select" ? (
												<Checkbox
													color="primary"
													indeterminate={
														selected.length > 0 && selected.length < orders.length
													}
													checked={
														orders.length > 0 && selected.length === orders.length
													}
													onChange={handleSelectAllClick}
													aria-label="select all orders"
												/>
											) : (
												<TableSortLabel
													active={orderBy === headCell.id}
													direction={orderBy === headCell.id ? order : "asc"}
													onClick={() => handleRequestSort(headCell.id)}
												>
													{headCell.label}
												</TableSortLabel>
											)}
										</TableCell>
									))}
								</TableRow>
							</TableHead>
							<TableBody>
								{paginatedOrders.map((order, index) => {
									const isItemSelected = isSelected(order.id);
									const labelId = `enhanced-table-checkbox-${index}`;
									return (
										<TableRow
											hover
											onClick={(event) => handleClick(event, order.id)}
											role="checkbox"
											aria-checked={isItemSelected}
											tabIndex={-1}
											key={order.id}
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
												{order.seriesNbr}
											</TableCell>
											<TableCell>{order.poRefNbr}</TableCell>
											<TableCell>{order.supplier}</TableCell>
											<TableCell>{getStatusChip(order.status)}</TableCell>
											<TableCell>
												{formatDate(order.periodFrom)}
											</TableCell>
											<TableCell>
												{formatDate(order.periodTo)}
											</TableCell>
											<TableCell>
												{formatDate(order.created)}
											</TableCell>
										</TableRow>
									);
								})}
								{emptyRows > 0 && (
									<TableRow style={{ height: 53 * emptyRows }}>
										<TableCell colSpan={8} />
									</TableRow>
								)}
							</TableBody>
						</Table>
					</TableContainer>
					<TablePagination
						component="div"
						count={orders.length}
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

export default PurchaseOrders;
