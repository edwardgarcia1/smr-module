import { Elysia, t } from "elysia";
import { findUserById, getAllUsers } from "./user.service";
import {
	getPermissionsByUserId,
	setUserPermissions,
	deleteUserPermissions,
} from "./permission.service";
import { authGuard } from "../../middlewares/auth";
import {
	caslMiddleware,
	checkPermission,
	type AppAbility,
} from "../../middlewares/casl";
import {
	BadRequestError,
	NotFoundError,
	UnauthorizedError,
} from "../../middlewares/error";
import type { AuthUser } from "../../middlewares/auth";

/**
 * Resolve a user ID from a route param, verifying auth + manage:User permission.
 * Shared by all three /:id/permissions handlers.
 */
async function resolveTargetUser(
	user: AuthUser | null,
	ability: AppAbility,
	id: string,
): Promise<number> {
	if (!user) throw new UnauthorizedError("Authentication required");
	checkPermission(ability, "manage", "Users");

	const targetId = Number(id);
	if (isNaN(targetId)) {
		throw new BadRequestError("Invalid user ID");
	}

	const targetUser = await findUserById(targetId, user.tenant);
	if (!targetUser) {
		throw new NotFoundError(`User ${id} not found`);
	}

	return targetId;
}

export const userRoutes = new Elysia({ prefix: "/users" })
	.use(authGuard)
	.use(caslMiddleware)
	.get("/", async ({ ability, user }) => {
		if (!user) {
			throw new UnauthorizedError("Authentication required");
		}

		// CASL RBAC check
		checkPermission(ability, "read", "Users");

		const users = await getAllUsers(user.tenant);
		return users.map(({ password, ...rest }) => rest);
	})
	.get("/profile", async ({ user }) => {
		// user is provided by authGuard
		if (!user) {
			throw new UnauthorizedError("Authentication required");
		}

		const userProfile = await findUserById(user.id, user.tenant);
		if (!userProfile) {
			throw new NotFoundError("User not found");
		}
		const { password, ...rest } = userProfile;
		return rest;
	})

	// ── Permission Management ──────────────────────────────────────

	// GET /users/:id/permissions — list user's permissions
	// Users can read their own permissions without manage:Users (needed for
	// frontend ability refresh).  Reading another user's permissions requires
	// manage:Users.
	.get(
		"/:id/permissions",
		async ({ params: { id }, ability, user }) => {
			if (!user) throw new UnauthorizedError("Authentication required");

			const targetId = Number(id);
			if (isNaN(targetId)) throw new BadRequestError("Invalid user ID");

			// Self-service: any authenticated user may read their own permissions
			if (targetId !== user.id) {
				checkPermission(ability, "manage", "Users");
			}

			const targetUser = await findUserById(targetId, user.tenant);
			if (!targetUser) {
				throw new NotFoundError(`User ${id} not found`);
			}

			return getPermissionsByUserId(targetId, user.tenant);
		},
		{
			params: t.Object({ id: t.String() }),
		},
	)

	// POST /users/:id/permissions — bulk set permissions (replaces all)
	.post(
		"/:id/permissions",
		async ({ params: { id }, body, ability, user }) => {
			const targetId = await resolveTargetUser(user, ability, id);

			await setUserPermissions(targetId, body, user!.tenant);
			return { message: "Permissions updated successfully" };
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Array(
				t.Object({
					subject: t.String(),
					action: t.String(),
				}),
			),
		},
	)

	// DELETE /users/:id/permissions — clear all permissions
	.delete(
		"/:id/permissions",
		async ({ params: { id }, ability, user }) => {
			const targetId = await resolveTargetUser(user, ability, id);
			await deleteUserPermissions(targetId, user!.tenant);
			return { message: "Permissions cleared successfully" };
		},
		{
			params: t.Object({ id: t.String() }),
		},
	);
