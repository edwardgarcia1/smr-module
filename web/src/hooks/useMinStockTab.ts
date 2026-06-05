/**
 * useMinStockTab — Shared hook for min-stock tab pages (ItemsTab, PrincipalsTab).
 *
 * Consolidates duplicated state initialization, fetch/loading/error lifecycle,
 * search filtering, and pagination logic that was previously duplicated across
 * both tab components.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import apiRequest from "../services/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic constraint for string-indexable objects
export interface UseMinStockTabOptions<T extends Record<string, any>> {
	/** API endpoint to fetch rows from */
	url: string;
	/** Row fields to search against (OR logic) */
	searchFields: (keyof T)[];
	/** Sort by this field using localeCompare */
	sortField?: keyof T;
	/** Custom sort function (alternative to sortField) */
	sortFn?: (a: T, b: T) => number;
	/**
	 * Additional row filter applied after search.
	 * Use useCallback with proper deps to avoid unnecessary recomputations.
	 */
	filterFn?: (row: T) => boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic constraint for string-indexable objects
export function useMinStockTab<T extends Record<string, any>>({
	url,
	searchFields,
	sortField,
	sortFn,
	filterFn,
}: UseMinStockTabOptions<T>) {
	const [rows, setRows] = useState<T[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);

	const fetchData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await apiRequest<T[]>(url);
			if (sortFn) {
				data.sort(sortFn);
			} else if (sortField) {
				data.sort((a, b) =>
					String(a[sortField]).localeCompare(String(b[sortField])),
				);
			}
			setRows(data);
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : "Failed to fetch data",
			);
		} finally {
			setLoading(false);
		}
	}, [url, sortField, sortFn]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const filteredRows = useMemo(() => {
		let result = rows;
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			result = result.filter((r) =>
				searchFields.some((f) =>
					String(r[f]).toLowerCase().includes(q),
				),
			);
		}
		if (filterFn) {
			result = result.filter(filterFn);
		}
		return result;
	}, [rows, searchQuery, searchFields, filterFn]);

	const paginatedRows = useMemo(
		() =>
			filteredRows.slice(
				page * rowsPerPage,
				page * rowsPerPage + rowsPerPage,
			),
		[filteredRows, page, rowsPerPage],
	);

	const handleSearchChange = useCallback((value: string) => {
		setSearchQuery(value);
		setPage(0);
	}, []);

	return {
		rows,
		setRows,
		loading,
		error,
		setError,
		searchQuery,
		setSearchQuery,
		page,
		setPage,
		rowsPerPage,
		setRowsPerPage,
		filteredRows,
		paginatedRows,
		fetchData,
		handleSearchChange,
	};
}
