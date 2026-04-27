import React, { useEffect, useState, useMemo } from "react";
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
	Chip,
	TablePagination,
	Checkbox,
	TableSortLabel,
	Skeleton,
	TextField,
	InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { api } from "../services/api";

interface User {
	id: number;
	username: string;
	name: string;
	role: string;
}

type Order = "asc" | "desc";
type OrderBy = "id" | "username" | "name" | "role";

const Users: React.FC = () => {
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);
	const [order, setOrder] = useState<Order>("asc");
	const [orderBy, setOrderBy] = useState<OrderBy>("id");
	const [selected, setSelected] = useState<readonly number[]>([]);
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		const fetchUsers = async () => {
			try {
				setLoading(true);
				const data = await api.apiRequest<User[]>("/users", { method: "GET" });
				setUsers(data);
				setError(null);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to fetch users");
			} finally {
				setLoading(false);
			}
		};

		fetchUsers();
	}, []);

	const handleRequestSort = (property: OrderBy) => {
		const isAsc = orderBy === property && order === "asc";
		setOrder(isAsc ? "desc" : "asc");
		setOrderBy(property);
	};

	const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (event.target.checked) {
			const newSelecteds = users.map((n) => n.id);
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

	// Avoid a layout jump when reaching the last page with empty rows.
	const emptyRows =
		page > 0 ? Math.max(0, (1 + page) * rowsPerPage - users.length) : 0;

	const filteredUsers = useMemo(() => {
		if (!searchQuery.trim()) return users;

		const query = searchQuery.toLowerCase().trim();

		return users.filter((user) => {
			return (
				user.id.toString().includes(query) ||
				user.username.toLowerCase().includes(query) ||
				user.name.toLowerCase().includes(query) ||
				user.role.toLowerCase().includes(query)
			);
		});
	}, [users, searchQuery]);

	const sortedUsers = useMemo(() => {
		return [...filteredUsers].sort((a, b) => {
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
	}, [filteredUsers, order, orderBy]);

	const paginatedUsers = sortedUsers.slice(
		page * rowsPerPage,
		page * rowsPerPage + rowsPerPage,
	);

	const getRoleColor = (role: string) => {
		switch (role.toLowerCase()) {
			case "superadmin":
				return "error";
			case "admin":
				return "warning";
			default:
				return "default";
		}
	};

	const headCells = [
		{ id: "select" as const, disablePadding: true, label: "" },
		{ id: "id" as const, disablePadding: false, label: "ID" },
		{ id: "username" as const, disablePadding: false, label: "Username" },
		{ id: "name" as const, disablePadding: false, label: "Name" },
		{ id: "role" as const, disablePadding: false, label: "Role" },
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
							placeholder="Search users..."
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
															selected.length < users.length
														}
														checked={
															users.length > 0 &&
															selected.length === users.length
														}
														onChange={handleSelectAllClick}
														aria-label="select all users"
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
												<TableCell component="th" scope="row" padding="none">
													<Skeleton variant="text" width={40} />
												</TableCell>
												<TableCell>
													<Skeleton variant="text" width={120} />
												</TableCell>
												<TableCell>
													<Skeleton variant="text" width={150} />
												</TableCell>
												<TableCell>
													<Skeleton variant="text" width={80} />
												</TableCell>
											</TableRow>
										))
									: paginatedUsers.map((user, index) => {
											const isItemSelected = isSelected(user.id);
											const labelId = `enhanced-table-checkbox-${index}`;
											return (
												<TableRow
													hover
													onClick={(event) => handleClick(event, user.id)}
													role="checkbox"
													aria-checked={isItemSelected}
													tabIndex={-1}
													key={user.id}
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
														{user.id}
													</TableCell>
													<TableCell>{user.username}</TableCell>
													<TableCell>{user.name}</TableCell>
													<TableCell>
														<Chip
															label={user.role.toUpperCase()}
															color={getRoleColor(user.role)}
															size="small"
														/>
													</TableCell>
												</TableRow>
											);
										})}
								{!loading && emptyRows > 0 && (
									<TableRow style={{ height: 53 * emptyRows }}>
										<TableCell colSpan={5} />
									</TableRow>
								)}
							</TableBody>
						</Table>
					</TableContainer>
					<TablePagination
						component="div"
						count={users.length}
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

export default Users;
