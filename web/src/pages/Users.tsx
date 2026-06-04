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
	TablePagination,
	Checkbox,
	TableSortLabel,
	Skeleton,
	TextField,
	InputAdornment,
	Typography,
	Button,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import { api } from "../services/api";
import UserPermissionsDialog from "../components/users/UserPermissionsDialog";

interface User {
	id: number;
	username: string;
	name: string;
}

type Order = "asc" | "desc";
type OrderBy = "id" | "username" | "name";

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
	const [permDialogUser, setPermDialogUser] = useState<{
		id: number;
		name: string;
	} | null>(null);

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

	const filteredUsers = useMemo(() => {
		if (!searchQuery.trim()) return users;

		const query = searchQuery.toLowerCase().trim();

		return users.filter((user) => {
			return (
				user.id.toString().includes(query) ||
				user.username.toLowerCase().includes(query) ||
				user.name.toLowerCase().includes(query)
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

	const headCells = [
		{ id: "select" as const, disablePadding: true, label: "" },
		{ id: "id" as const, disablePadding: false, label: "ID" },
		{ id: "username" as const, disablePadding: false, label: "Username" },
		{ id: "name" as const, disablePadding: false, label: "Name" },
		{ id: "actions" as const, disablePadding: false, label: "Actions", sortable: false },
	];

	return (
		<Box
			sx={{
				height: "calc(100dvh - 130px)",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				width: "100%",
			}}
		>
			{error && (
				<Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			)}

			<Paper
				sx={{
					flex: 1,
					overflow: "hidden",
					display: "flex",
					flexDirection: "column",
					borderRadius: 2,
				}}
			>
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						px: 2,
						pt: 1.5,
						pb: 1.5,
						borderBottom: "1px solid",
						borderColor: "divider",
						gap: 2,
					}}
				>
					<Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
						Users
					</Typography>
					<TextField
						variant="outlined"
						placeholder="Search users..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						size="small"
						slotProps={{
							input: {
								startAdornment: (
									<InputAdornment position="start">
										<SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} />
									</InputAdornment>
								),
							},
						}}
						sx={{
							width: 280,
							"& .MuiOutlinedInput-root": { borderRadius: 2, height: 36 },
							"& .MuiInputBase-input": { paddingY: 0 },
						}}
					/>
					{!loading && (
						<Typography variant="caption" sx={{ color: "text.secondary" }}>
							{users.length} records
						</Typography>
					)}
				</Box>

				{loading ? (
					<Box sx={{ flex: 1, overflow: "auto" }}>
						<Table size="small">
							<TableHead>
								<TableRow>
									{headCells.map((hc) => (
										<TableCell
											key={hc.id}
											padding={hc.disablePadding ? "none" : "normal"}
											sx={{ fontWeight: 600 }}
										>
											{hc.label}
										</TableCell>
									))}
								</TableRow>
							</TableHead>
							<TableBody>
								{Array.from({ length: rowsPerPage }, (_, i) => (
									<TableRow key={i}>
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
									</TableRow>
								))}
							</TableBody>
						</Table>
					</Box>
				) : (
					<>
						<TableContainer sx={{ flex: 1, overflow: "auto" }}>
							<Table size="small" aria-labelledby="tableTitle">
								<TableHead>
									<TableRow>
										{headCells.map((headCell) => (
											<TableCell
												key={headCell.id}
												padding={headCell.disablePadding ? "none" : "normal"}
												sortDirection={orderBy === headCell.id ? order : false}
												sx={{ fontWeight: 600 }}
											>
												{headCell.id === "select" ? (
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
													/>
												) : headCell.id === "actions" ? (
													headCell.label
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
									{paginatedUsers.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={5}
												align="center"
												sx={{ py: 4, color: "text.secondary" }}
											>
												No users found
											</TableCell>
										</TableRow>
									) : (
										paginatedUsers.map((user, index) => {
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
														<Button
															variant="outlined"
															size="small"
															startIcon={<ManageAccountsIcon />}
															onClick={(e) => {
																e.stopPropagation();
																setPermDialogUser({ id: user.id, name: user.name });
															}}
															sx={{
																textTransform: "none",
																fontSize: "0.75rem",
																minWidth: 0,
																whiteSpace: "nowrap",
															}}
														>
															Permissions
														</Button>
													</TableCell>
												</TableRow>
											);
										})
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
							rowsPerPageOptions={[10, 20, 50]}
							sx={{ flexShrink: 0 }}
						/>
					</>
				)}
			</Paper>

			{permDialogUser && (
				<UserPermissionsDialog
					open={!!permDialogUser}
					userId={permDialogUser.id}
					userName={permDialogUser.name}
					onClose={() => setPermDialogUser(null)}
				/>
			)}
		</Box>
	);
};

export default Users;
