# SMR Module — Inventory & Supply Management System

Full-stack app for managing purchase requirements, inventory items, suppliers, purchase orders, and pricing. Built with **Bun**, **Elysia**, **React 19**, **MUI 9**, and **MSSQL**.

## Features

- **Dashboard**: Summary cards (immediate/secondary/monitoring purchases), quick stats, quick actions.
- **Purchasing Requirements**: Dynamic filter panel (principal, storage, class, frequency, date range), DataGrid with monthly demand columns, editable factor/custom order, Excel export.
- **Inventory Items**: Supplier inventory view with price class coding.
- **Suppliers**: Card grid of supplier contacts.
- **Purchase Orders**: PO tracking with status chips.
- **Prices**: Item pricing table.
- **User Management**: Role-based access (superadmin/admin/user).
- **Auth**: JWT access/refresh tokens. httpOnly cookies for web, JSON body for mobile.
- **RBAC**: CASL — superadmin (full), admin (read users, manage settings), user (read settings).
- **Dark Mode**: Light/dark toggle persisted in localStorage.

## Stack

### Backend (`api/`)
| Layer | |
|-------|---|
| Runtime | Bun |
| Framework | Elysia 1.4 |
| Database | MSSQL (raw queries via `mssql`) |
| Auth | JWT (HS256) — access 15min, refresh 7d |
| RBAC | CASL 6.8 |
| Docs | Swagger (OpenAPI) at `/api/docs` |
| Testing | Eden Treaty (E2E) |

### Frontend (`web/`)
| Layer | |
|-------|---|
| Framework | React 19 + TypeScript 6 |
| Build | Vite 8 + React Compiler |
| UI | MUI 9 + Emotion |
| Data Grid | MUI X DataGrid 9 + Date Pickers |
| Router | React Router 7 (lazy routes) |
| State | Zustand 5 |
| Excel | `xlsx` |

## Project Structure

```
smr-module/
├── api/                        # Elysia backend
│   ├── src/
│   │   ├── index.ts            # Server entry + CORS
│   │   ├── routes.ts           # Route aggregation
│   │   ├── migrate.ts          # DB setup + seed
│   │   ├── config/
│   │   │   └── db.ts           # MSSQL connection pool
│   │   ├── middlewares/
│   │   │   ├── auth.ts         # JWT derive guard
│   │   │   ├── jwt.ts          # Token sign/verify
│   │   │   ├── casl.ts         # Authorization
│   │   │   ├── error.ts        # Error classes + handler
│   │   │   └── rateLimit.ts    # 60 req/min per IP
│   │   ├── modules/
│   │   │   ├── users/          # Auth + user CRUD
│   │   │   └── inventory/      # Site CRUD
│   │   ├── shared/auth.ts      # Token helpers
│   │   └── utils/trimStrings.ts# MSSQL padding fix
│   └── package.json
├── web/                        # React frontend
│   ├── src/
│   │   ├── App.tsx             # Routes + layout
│   │   ├── config/ability.ts   # CASL definitions
│   │   ├── layouts/            # AppLayout, AppHeader, AppSidebar
│   │   ├── pages/              # Home, Login, Users, InventoryItems,
│   │   │                       # Suppliers, PurchaseOrders,
│   │   │                       # PurchasingRequirements, Prices, etc.
│   │   ├── providers/          # Theme (dark mode)
│   │   ├── services/api.ts     # Fetch wrapper + auto-refresh
│   │   ├── store/useAuthStore.ts# Zustand auth state
│   │   └── utils/exportToExcel.ts
│   └── package.json
├── AGENTS.md                   # AI instructions
├── CONTEXT.md                  # Project context
└── README.md                   # This file
```

## Prerequisites

- **Bun**: [Install Bun](https://bun.sh/docs/installation)
- **MSSQL Server**: Local or remote instance
- **Node.js v18+**: Optional, for tooling

## Getting Started

### 1. Install Dependencies

**Backend only** — no root install:

```bash
cd api
bun install
```

**Frontend:**

```bash
cd web
bun install
```

### 2. Environment Setup

**Backend (`api/.env`):**

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

**Frontend (`web/.env`):**

```env
VITE_API_BASE_URL=http://localhost:3000
```

### 3. Database Setup

The `Site` table must exist in your MSSQL database.

Run the migration script to create `SMR_Users` table and seed the superadmin user:

```bash
cd api
bun run db:migrate
```

This creates the `SMR_Users` table (id, username, password/bcrypt, name, role) and inserts the superadmin from env vars.

### 4. Run Development

Two terminals:

```bash
# Terminal 1 — Backend (port 3000)
cd api
bun run dev

# Terminal 2 — Frontend (port 5173)
cd web
bun run dev
```

- API: `http://localhost:3000`
- Swagger docs: `http://localhost:3000/api/docs`
- Frontend: `http://localhost:5173`

### 5. Production

```bash
# Backend
cd api
bun run build
bun run start

# Frontend
cd web
bun run build
bun run preview
```

## API Endpoints

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/api/auth/login` | No | — | Login (cookie or JSON body) |
| POST | `/api/auth/register` | No | — | Register new user |
| POST | `/api/auth/refresh` | No | — | Refresh access token |
| POST | `/api/auth/logout` | No | — | Clear auth cookies |
| POST | `/api/auth/me` | Yes | Any | Current user profile |
| GET | `/api/users` | Yes | superadmin | List all users |
| GET | `/api/users/profile` | Yes | Any | Own profile |
| GET | `/api/inventory` | Yes | superadmin | List sites |
| GET | `/api/inventory/:siteId` | Yes | superadmin | Get site |
| POST | `/api/inventory` | Yes | superadmin | Create site |
| PUT | `/api/inventory/:siteId` | Yes | superadmin | Update site |
| DELETE | `/api/inventory/:siteId` | Yes | superadmin | Delete site |

## Development Status

| Feature | Status |
|---------|--------|
| Auth (login/register/refresh/logout) | Working |
| User CRUD | Working (DB-backed) |
| Site CRUD | Working (DB-backed) |
| Dashboard | Frontend only (hardcoded) |
| Inventory Items | Frontend only (hardcoded) |
| Suppliers | Frontend only (hardcoded) |
| Purchase Orders | Frontend only (hardcoded) |
| Purchasing Requirements | Frontend only (hardcoded) |
| Prices | Frontend only (hardcoded) |

## Port Configuration

If default ports conflict, use 5-digit ports:

```bash
# Backend
PORT=30001 bun run dev

# Frontend
bun run dev -- --port 30001
```

## License

MIT
