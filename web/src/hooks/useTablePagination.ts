/**
 * useTablePagination — Generic hook for pagination + sorting logic.
 * Extracted from PurchaseOrders.tsx and Users.tsx to eliminate
 * duplicated handleChangePage / handleChangeRowsPerPage / sorted rows / paginated rows.
 */
import { useState, useMemo, useCallback } from "react";

export type SortOrder = "asc" | "desc";

interface UseTablePaginationOptions<T> {
	/** The full (possibly filtered) data array */
	data: T[];
	/** Initial page (default 0) */
	initialPage?: number;
	/** Rows per page (default 10) */
	initialRowsPerPage?: number;
	/** Initial sort direction */
	initialOrder?: SortOrder;
	/** Initial sort column key */
	initialOrderBy?: keyof T;
	/** Comparator: when not provided, defaults to localeCompare for strings and numeric compare otherwise */
	comparator?: (a: T, b: T, orderBy: keyof T, order: SortOrder) => number;
}

interface UseTablePaginationResult<T> {
	page: number;
	setPage: (page: number) => void;
	rowsPerPage: number;
	setRowsPerPage: (rowsPerPage: number) => void;
	order: SortOrder;
	orderBy: keyof T;
	handleRequestSort: (property: keyof T) => void;
	handleChangePage: (_event: unknown, newPage: number) => void;
	handleChangeRowsPerPage: (event: React.ChangeEvent<HTMLInputElement>) => void;
	/** The sorted slice of data for the current page */
	paginatedData: T[];
}

/**
 * Default comparator: localeCompare for strings, numeric comparison otherwise.
 */
function defaultComparator<T>(
	a: T,
	b: T,
	orderBy: keyof T,
	order: SortOrder,
): number {
	const aVal = a[orderBy];
	const bVal = b[orderBy];
	let comparison = 0;
	if (typeof aVal === "string" && typeof bVal === "string") {
		comparison = aVal.localeCompare(bVal);
	} else {
		comparison = (aVal as number) < (bVal as number) ? -1 : 1;
	}
	return order === "asc" ? comparison : -comparison;
}

export function useTablePagination<T>({
	data,
	initialPage = 0,
	initialRowsPerPage = 10,
	initialOrder = "asc" as SortOrder,
	initialOrderBy,
	comparator,
}: UseTablePaginationOptions<T>): UseTablePaginationResult<T> {
	const [page, setPage] = useState(initialPage);
	const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);
	const [order, setOrder] = useState<SortOrder>(initialOrder);
	const [orderBy, setOrderBy] = useState<keyof T>(initialOrderBy!);

	const handleRequestSort = useCallback((property: keyof T) => {
		setOrderBy((prev) => {
			setOrder((o) => (prev === property && o === "asc" ? "desc" : "asc"));
			return property;
		});
	}, []);

	const handleChangePage = useCallback((_event: unknown, newPage: number) => {
		setPage(newPage);
	}, []);

	const handleChangeRowsPerPage = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setRowsPerPage(parseInt(event.target.value, 10));
			setPage(0);
		},
		[],
	);

	const cmp = comparator ?? defaultComparator;

	const paginatedData = useMemo<T[]>(() => {
		const sorted = [...data].sort((a, b) => cmp(a, b, orderBy, order));
		return sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
	}, [data, order, orderBy, page, rowsPerPage, cmp]);

	return {
		page,
		setPage,
		rowsPerPage,
		setRowsPerPage,
		order,
		orderBy,
		handleRequestSort,
		handleChangePage,
		handleChangeRowsPerPage,
		paginatedData,
	};
}
