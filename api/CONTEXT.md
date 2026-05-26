# CONTEXT.md - API

## Stack
- **Runtime**: Bun
- **Framework**: Elysia 1.4
- **DB Driver**: `mssql` (raw queries, no ORM)
- **Auth**: `@elysiajs/jwt` (HS256), access (15min) + refresh (7d) tokens
- **RBAC**: `@casl/ability` 6.8
- **Docs**: `@elysiajs/swagger` (at `/api/docs`)
- **Testing**: `@elysiajs/eden` (E2E)

## Auth Flow
```
Login → JWT sign (access 1h, refresh 7d) → Set httpOnly cookies.
Web: cookie-based (credentials: include).
Mobile: x-client-type: mobile → JSON body tokens.
Refresh: POST /auth/refresh reads refreshToken cookie → new accessToken.
```

## Middleware Chain
1. **CORS** — Allow configurable origins (env `CORS_ORIGIN`).
2. **Auth guard** — Derive `user` on protected routes. Reads Bearer header → cookie → `accessToken` cookie. Attach `AuthUser` to context.
3. **CASL** — `checkPermission(action, subject)`. Only superadmin has `manage` on `User` and `Site`.
4. **Error handler** — Catches all, formats JSON. Handles Elysia validation errors.

## DB
- MSSQL 2008+ compatible.
- Connection: `getDb()` returns pool singleton.
- Config from env: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`.
- `encrypt: false`, `trustServerCertificate: true` (local/on-prem).
- Tables: `SMR_Users` (auto-created by migrate), `Site` (assumed existing).

## Module Pattern
Each module = 3 files:
- `{name}.schema.ts` — TypeScript interfaces + DDL comments
- `{name}.service.ts` — DB queries + business logic
- `{name}.routes.ts` — Elysia route definitions

Register routes in `src/routes.ts`.

## Error Classes
| Class | Status | When |
|-------|--------|------|
| `BadRequestError` | 400 | Validation failure |
| `UnauthorizedError` | 401 | No/invalid token |
| `ForbiddenError` | 403 | Insufficient role |
| `NotFoundError` | 404 | Resource missing |

## Current Modules
- **users**: Auth routes (login/register/refresh/logout/me) + user routes (list/profile).
- **inventory**: Site CRUD (superadmin only). Table `Site` must exist in DB.

## Important Notes
- Drizzle ORM is NOT used despite template docs. All DB ops are raw SQL.
- Password: bcrypt hash (cost 10) via `Bun.password.hash`.
- String trim utility for MSSQL CHAR/NCHAR padding artifacts.
