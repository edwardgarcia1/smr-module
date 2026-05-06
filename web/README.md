# Web — SMR Module Frontend

React 19 + Vite 8 + MUI 9 frontend for Inventory & Supply Management System. Dashboard, purchasing requirements, inventory tracking, supplier management, PO tracking, pricing, auth, RBAC.

## Prerequisites

- **Bun**: 1.1+ (or Node.js v18+)
- **API Backend**: Running instance of the SMR API

## Getting Started

### Install

```bash
bun install
```

### Environment

Create `web/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

Default backend URL is `http://localhost:3000` if env not set.

### Run

**Development:**

```bash
bun run dev
```

**Production:**

```bash
bun run build
bun run preview
```

## Project Structure

```
web/
├── src/
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Routes (lazy-loaded) + layout guards
│   ├── index.css                 # Base styles
│   ├── theme.css                 # CSS variables, sidebar, scrollbar
│   ├── config/
│   │   ├── ability.ts            # CASL permission definitions
│   │   └── AbilityProvider.tsx   # CASL context provider
│   ├── layouts/
│   │   ├── AppLayout.tsx         # Sidebar + header + content shell
│   │   ├── AppHeader.tsx         # Top bar with tab name + date
│   │   └── AppSidebar.tsx        # Nav drawer with CASL-gated items
│   ├── pages/
│   │   ├── Home.tsx              # Dashboard: cards, stats, quick actions
│   │   ├── Login.tsx             # Username + password login form
│   │   ├── Register.tsx          # Registration form with validation
│   │   ├── Users.tsx             # User list (real API, superadmin only)
│   │   ├── Profile.tsx           # User profile (real API)
│   │   ├── Settings.tsx          # Dark mode toggle + monthly factor
│   │   ├── InventoryItems.tsx    # Placeholder inventory item grid
│   │   ├── Suppliers.tsx         # Placeholder supplier card grid
│   │   ├── PurchaseOrders.tsx    # Placeholder PO tracker
│   │   ├── PurchasingRequirements.tsx  # Placeholder — largest page
│   │   ├── Prices.tsx            # Placeholder pricing table
│   │   └── Loading.tsx           # Skeleton placeholder
│   ├── providers/
│   │   └── AppProvider.tsx       # MUI theme + dark mode (localStorage)
│   ├── services/
│   │   ├── api.ts                # Fetch wrapper + auto-401-refresh
│   │   └── index.ts              # Service exports
│   ├── store/
│   │   └── useAuthStore.ts       # Auth state (Zustand)
│   ├── utils/
│   │   └── exportToExcel.ts      # XLSX export from DataGrid
│   └── assets/                   # Static images
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── plans/
│   └── purchase-requirements-page.md
└── package.json
```

## Scripts

| Script | Description |
|--------|-------------|
| `dev` | Start Vite dev server (port 5173) |
| `build` | TypeScript check + production build |
| `lint` | Run ESLint |
| `preview` | Preview production build |
| `typecheck` | Check TypeScript types |

## Routes

| Path | Page | Guard |
|------|------|-------|
| `/login` | Login | GuestRoute (redirects if authed) |
| `/register` | Register | GuestRoute |
| `/` | Home dashboard | ProtectedRoute |
| `/users` | Users list | ProtectedRoute |
| `/inventory-items` | Inventory Items | ProtectedRoute |
| `/suppliers` | Suppliers | ProtectedRoute |
| `/purchase-orders` | Purchase Orders | ProtectedRoute |
| `/purchasing-requirements` | Purchasing Requirements | ProtectedRoute |
| `/prices` | Prices | ProtectedRoute |
| `/settings` | Settings | ProtectedRoute |
| `/profile` | Profile | ProtectedRoute |

All pages lazy-loaded via `React.lazy()` + `Suspense`.

## Auth & RBAC

### Auth Flow

1. App mounts → `checkAuth()` → `POST /api/auth/me`
2. 200: set user in Zustand store → render protected routes
3. 401: set user=null → redirect to `/login`

### Token Management

- httpOnly cookies (automatic with `credentials: include`).
- API client intercepts 401 → calls `/api/auth/refresh` → retries original request.
- Refresh failure → logout.

### CASL Permissions

| Role | Abilities |
|------|-----------|
| superadmin | `manage` all subjects |
| admin | `read` users, `manage` settings |
| user | `read` settings |

Sidebar uses `<Can I="read" this="...">` to show/hide nav items. Subjects must be defined in `config/ability.ts`.

**Note**: Sidebar subjects (`purchasing-requirements`, `inventory-items`, `suppliers`, `purchase-orders`, `prices`) are NOT individually defined in `ability.ts` — only `users` and `settings` are. Non-superadmin roles will not see sidebar items for those pages.

## Styling & UI

- **MUI 9**: Primary UI library with Emotion CSS-in-JS.
- **Theme**: Purple accent palette. Customizable in `providers/AppProvider.tsx`.
- **Dark Mode**: Toggle in Settings. Persisted in `localStorage` key `userSettings`. Falls back to system `prefers-color-scheme`.
- **Sidebar**: Dark blue (`#1e3a5f`) in light mode, dark gray (`#16171d`) in dark mode. Collapsible to 56px icon-only mode.

## API Integration

- **Service**: `services/api.ts` — wrapper around `fetch`.
- **Base URL**: From `VITE_API_BASE_URL` env var (default `http://localhost:3000`).
- **Credentials**: `include` (cookie-based auth).
- **Headers**: Auto-sends `Content-Type: application/json` and `x-client-type: web`.
- **Auth Refresh**: Intercepts 401, attempts `/api/auth/refresh`, retries original request.
- **FormData**: Detects and sends without `Content-Type` header (browser sets multipart boundary).

## Development Status

| Page | Data Source |
|------|-------------|
| Login, Register | Real API |
| Users, Profile | Real API |
| Home (Dashboard) | Hardcoded placeholder |
| InventoryItems | Hardcoded placeholder |
| Suppliers | Hardcoded placeholder |
| PurchaseOrders | Hardcoded placeholder |
| PurchasingRequirements | Hardcoded placeholder (most complex page) |
| Prices | Hardcoded placeholder |
| Settings | localStorage |

## Port Configuration

Default port is `5173`. Override:

```bash
bun run dev -- --port 30001
```
