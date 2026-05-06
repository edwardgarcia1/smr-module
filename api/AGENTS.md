# AGENTS.md - API

## Identity
Elysia backend for SMR Module. Auth, users, inventory CRUD.

## Rules
1. **DB is MSSQL**: Raw queries via `mssql` pool. No ORM (no Drizzle).
2. **Error handling**: Use `CustomError` subclasses (`BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`). Import from `middlewares/error.ts`.
3. **Auth guard**: Use `authGuard` derive in routes for protected endpoints.
4. **RBAC**: Use `checkPermission` from `middlewares/casl.ts`. Define new subjects in CASL config.
5. **DB connection**: `getDb()` from `config/db.ts` — singleton pool.
6. **New modules**: Mirror `modules/users/` structure: `{module}.schema.ts`, `{module}.service.ts`, `{module}.routes.ts`. Register in `routes.ts`.
7. **Validation**: Use Elysia `t` for body/query/param validation in route definitions.
8. **String trimming**: Use `trimStrings` util for MSSQL CHAR/NCHAR padding.
9. **Port**: Default `3000`. Override via `PORT` env. Use 5-digit for local dev.
10. **Env vars**: Copy `.env` template if missing. Never commit real `.env`.
11. **Mobile client test**: `x-client-type: mobile` header → JSON tokens instead of cookies.

## Structure
```
src/
├── index.ts            # Entry, CORS, middleware
├── routes.ts           # Route aggregation
├── migrate.ts          # DB setup + seed
├── config/
│   └── db.ts           # MSSQL pool
├── middlewares/
│   ├── auth.ts         # JWT derive guard
│   ├── jwt.ts          # Token sign/verify
│   ├── casl.ts         # Authorization
│   ├── error.ts        # Error classes + handler
│   └── rateLimit.ts    # In-memory rate limiter
├── modules/
│   ├── users/          # Auth + user CRUD
│   └── inventory/      # Site CRUD
├── shared/
│   └── auth.ts         # Token extraction helpers
└── utils/
    └── trimStrings.ts  # Whitespace trim
```

## Commands
- `bun run dev` — Dev server (hot reload)
- `bun run build` — Production build
- `bun run start` — Start production
- `bun run test` — Run E2E tests (Eden Treaty)
- `bun run typecheck` — Check types
- `bun run db:migrate` — Create tables + seed superadmin
