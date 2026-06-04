import { withDb } from "../../config/db";
import type { Permission } from "./permission.schema";

export const getPermissionsByUserId = async (
	userId: number,
): Promise<Permission[]> => {
	const result = await withDb((pool) =>
		pool
			.request()
			.input("userId", userId)
			.query("SELECT * FROM SMR_Permissions WHERE user_id = @userId"),
	);
	return result.recordset as Permission[];
};

export const setUserPermissions = async (
	userId: number,
	permissions: Array<{ subject: string; action: string }>,
): Promise<void> => {
	if (permissions.length === 0) {
		// No permissions to set — just delete existing
		await deleteUserPermissions(userId);
		return;
	}

	await withDb(async (pool) => {
		const transaction = pool.transaction();
		await transaction.begin();

		try {
			// Delete existing permissions
			await transaction
				.request()
				.input("userId", userId)
				.query("DELETE FROM SMR_Permissions WHERE user_id = @userId");

			// Batch INSERT using multi-row VALUES
			const valueClauses = permissions.map(
				(_, i) => `(@userId, @subject${i}, @action${i})`,
			);
			const batchInsertSql = `INSERT INTO SMR_Permissions (user_id, subject, action) VALUES ${valueClauses.join(",\n")}`;

			const insertRequest = transaction.request().input("userId", userId);
			for (let i = 0; i < permissions.length; i++) {
				const perm = permissions[i]!;
				insertRequest.input(`subject${i}`, perm.subject);
				insertRequest.input(`action${i}`, perm.action);
			}
			await insertRequest.query(batchInsertSql);

			await transaction.commit();
		} catch (err) {
			await transaction.rollback();
			throw err;
		}
	});
};

export const deleteUserPermissions = async (userId: number): Promise<void> => {
	await withDb((pool) =>
		pool
			.request()
			.input("userId", userId)
			.query("DELETE FROM SMR_Permissions WHERE user_id = @userId"),
	);
};
