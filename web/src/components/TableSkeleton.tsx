/**
 * TableSkeleton — Reusable loading placeholder that mirrors a table structure.
 *
 * Renders rows of animated skeleton cells matching the provided column
 * configuration so the loading state visually matches the actual table.
 */
import React from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableRow,
	Skeleton,
} from "@mui/material";

interface SkeletonCol {
	align?: "left" | "right" | "center";
	icon?: boolean;
	spacer?: boolean;
	/** Fixed column width in px — mirrors DataGrid column widths. */
	width?: number;
}

type SkeletonAnimation = "pulse" | "wave" | false;

/** Deterministic pseudo-random width so rows don't look uniform. */
function skelWidthPct(row: number, col: number): number {
	return 40 + ((row * 7 + col * 13 + col * 3) % 56);
}

interface TableSkeletonProps {
	cols: SkeletonCol[];
	rows?: number;
	/** Fixed row height in px — mirrors DataGrid getRowHeight. */
	rowHeight?: number;
	/** Skeleton animation variant. "pulse" is lighter than "wave". Default "wave". */
	animation?: SkeletonAnimation;
}

const TableSkeleton: React.FC<TableSkeletonProps> = ({
	cols,
	rows = 5,
	rowHeight,
	animation = "wave",
}) => (
	<TableContainer>
		<Table size="small">
			<TableBody>
				{Array.from({ length: rows }, (_, i) => (
					<TableRow
						key={i}
						{...(rowHeight ? { sx: { height: rowHeight } } : {})}
					>
						{cols.map((col, j) =>
							col.spacer ? (
								<TableCell
									key={j}
									sx={{ p: 0, width: 0, borderBottom: "unset" }}
								/>
							) : col.icon ? (
								<TableCell
									key={j}
									sx={{
										width: col.width ?? 48,
										px: 1,
										textAlign: col.align ?? "left",
									}}
								>
									<Skeleton
										animation={animation}
										variant="circular"
										width={20}
										height={20}
									/>
								</TableCell>
							) : (
								<TableCell
									key={j}
									sx={{
										textAlign: col.align ?? "left",
										...(col.width ? { width: col.width } : {}),
									}}
								>
									<Skeleton
										animation={animation}
										variant="text"
										sx={{
											width: `${skelWidthPct(i, j)}%`,
											maxWidth: 200,
											display: "inline-block",
										}}
									/>
								</TableCell>
							),
						)}
					</TableRow>
				))}
			</TableBody>
		</Table>
	</TableContainer>
);

export default TableSkeleton;
