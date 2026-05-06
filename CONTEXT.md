# CONTEXT.md - SMR Module

## Project
Inventory & Supply Management System (SMR Module).
Manage purchase requirements, inventory items, suppliers, purchase orders, prices.

## Stack
- **Runtime**: Bun
- **Backend**: Elysia (TypeScript, ES2024)
- **Frontend**: React 19 + Vite 8 + TypeScript 6 + MUI 9
- **DB**: MSSQL via `mssql` package (raw queries, no ORM)
- **Auth**: JWT (HS256), httpOnly cookies (web) / JSON body (mobile)
- **RBAC**: CASL (superadmin/admin/user)
- **State**: Zustand 5
- **Router**: React Router 7
- **Excel**: `xlsx` library

## Repo Structure
```
smr-module/
├── api/            # Backend (Elysia)
├── web/            # Frontend (React)
├── AGENTS.md       # AI instructions
├── CONTEXT.md      # This file
└── .gitignore
```

## Auth
- Login returns accessToken (15min) + refreshToken (7d) in httpOnly cookies.
- Web uses cookie auth (`credentials: include`).
- Mobile (`x-client-type: mobile` header) returns tokens in JSON body.
- Auto-refresh on 401 via `/api/auth/refresh`.
- Roles: `superadmin` (full access), `admin` (read users, manage settings), `user` (read settings).

## Key API Endpoints
| Method | Path | Auth | Note |
|--------|------|------|------|
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/register` | No | Register |
| POST | `/api/auth/me` | Yes | Current user |
| GET | `/api/users` | Yes | List users (superadmin) |
| GET/POST/PUT/DELETE | `/api/inventory` | Yes | Site CRUD (superadmin) |

## State of Implementation
- **Users module**: Fully implemented (DB-backed CRUD + auth).
- **Inventory module**: Site CRUD backed by DB.
- **Business pages** (InventoryItems, Suppliers, PurchaseOrders, PurchasingRequirements, Prices): **Placeholder/hardcoded data**. No real API integration.
- **CASL subjects mismatch**: Sidebar uses subjects like `purchasing-requirements`, `inventory-items` but `ability.ts` only defines `users`, `settings`, `all`. Sidebar items invisible to non-superadmin.

## DB
- MSSQL 2008+ compatible DDL.
- Table `SMR_Users` (id, username, password/bcrypt, name, role).
- Table `Site` (SiteId, Name) — assumed existing in `MLDIAPP` database.
