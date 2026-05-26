# API — SMR Module Backend

Elysia backend for Inventory & Supply Management System. Auth, user CRUD, inventory site CRUD. MSSQL, JWT, CASL RBAC.

## Prerequisites

- **Bun**: 1.1+
- **MSSQL Server**: Running instance

## Getting Started

### Install

```bash
bun install
```

### Environment

Create `api/.env`:

```env
DB_HOST=localhost
DB_USER=sa
DB_PASSWORD=your_password
DB_NAME=your_database
DB_PORT=1433

SUPERADMIN_USERNAME=sadmin123
SUPERADMIN_PASSWORD=your_password
SUPERADMIN_NAME="Super Administrator"

JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

CORS_ORIGIN=http://localhost:5173

NODE_ENV=development
```

### Database Setup

The `Site` table must exist in your MSSQL database.

Create `SMR_Users` table and seed superadmin:

```bash
bun run db:migrate
```

This runs `src/migrate.ts` — creates `SMR_Users` (id, username, password/bcrypt, name, role) and inserts the superadmin user from env vars if not present.

### Run

**Development:**

```bash
bun run dev
```

**Production:**

```bash
bun run build
bun run start
```

## Project Structure

```
api/
├── src/
│   ├── index.ts            # Server entry + CORS
│   ├── routes.ts           # Route aggregation
│   ├── migrate.ts          # DB setup + superadmin seed
│   ├── config/
│   │   └── db.ts           # MSSQL connection pool (singleton)
│   ├── middlewares/
│   │   ├── auth.ts         # JWT derive guard (header + cookie)
│   │   ├── jwt.ts          # Access + refresh token sign/verify
│   │   ├── casl.ts         # RBAC permissions
│   │   ├── error.ts        # Custom error classes + handler

│   ├── modules/
│   │   ├── users/          # Auth routes + user CRUD
│   │   │   ├── auth.routes.ts
│   │   │   ├── users.routes.ts
│   │   │   ├── user.schema.ts
│   │   │   └── user.service.ts
│   │   └── inventory/      # Site CRUD (superadmin only)
│   │       ├── inventory.routes.ts
│   │       ├── inventory.schema.ts
│   │       └── inventory.service.ts
│   ├── shared/
│   │   └── auth.ts         # Token extraction helpers
│   └── utils/
│       └── trimStrings.ts  # MSSQL CHAR/NCHAR padding trim
├── test/
│   └── index.test.ts       # E2E tests (Eden Treaty)
└── package.json
```

## Scripts

| Script | Description |
|--------|-------------|
| `dev` | Dev server with hot reload (`bun --watch`) |
| `build` | Build for production |
| `start` | Run production build |
| `test` | Run E2E tests (Bun test runner + Eden) |
| `typecheck` | TypeScript type check |
| `db:migrate` | Create `SMR_Users` table + seed superadmin |

## Auth & Authorization

### JWT Strategy

- **Access Token**: 1h expiry, HS256, stored in httpOnly cookie (web) or JSON body (mobile).
- **Refresh Token**: 7d expiry, stored in httpOnly cookie.
- **Auto-refresh**: Frontend 401 interceptor calls `/api/auth/refresh`.
- **Mobile**: Send `x-client-type: mobile` header → tokens returned in JSON body.

Token extraction order: `Authorization: Bearer <token>` header → `authorization` cookie (Bearer prefixed) → `accessToken` cookie.

### RBAC (CASL)

| Role | Subjects |
|------|----------|
| `superadmin` | `manage` all (User, Site) |
| `admin` | `read` User, `manage` settings |
| `user` | `read` settings |

Permissions defined in `src/middlewares/casl.ts`. Enforced via `checkPermission(action, subject)`.

## API Endpoints

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Register user (username, password, name) |
| POST | `/api/auth/login` | No | Login, returns httpOnly cookies or JSON |
| POST | `/api/auth/logout` | No | Clear auth cookies |
| POST | `/api/auth/refresh` | No | Refresh access token |
| POST | `/api/auth/me` | Yes | Current user profile |

### Users

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/users` | Yes | superadmin | List all users (no passwords) |
| GET | `/api/users/profile` | Yes | Any | Own profile |

### Inventory (Sites)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/inventory` | Yes | superadmin | List all sites |
| GET | `/api/inventory/:siteId` | Yes | superadmin | Get single site |
| POST | `/api/inventory` | Yes | superadmin | Create site (SiteId max 10, Name max 30) |
| PUT | `/api/inventory/:siteId` | Yes | superadmin | Update site name |
| DELETE | `/api/inventory/:siteId` | Yes | superadmin | Delete site |

### Docs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/docs` | Swagger UI |

## Database

- **MSSQL** via `mssql` npm package (raw queries, no ORM).
- Connection pool singleton via `getDb()` in `src/config/db.ts`.
- Config: `encrypt: false`, `trustServerCertificate: true`.
- Table `SMR_Users` — auto-created by `db:migrate`.
- Table `Site` — must exist in database (assumed from `MLDIAPP`).

## Configuration

- **CORS**: Configured in `src/index.ts`. Supports multiple origins (comma/space separated in env).
- **Rate Limit**: 60 requests/minute/IP. In-memory Map (resets on restart, not shared across instances).
- **Swagger**: Available at `/api/docs` when running.
- **Error handling**: `CustomError` subclasses — `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404).

## Notes

- No Drizzle ORM despite template docs. All DB operations are raw SQL.
- Passwords hashed with bcrypt (cost 10) via `Bun.password.hash`.
