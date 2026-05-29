# CONTEXT.md - Web

## Stack
- **UI**: React 19 + TypeScript 6 + MUI 9 + Emotion
- **Build**: Vite 8 + `@vitejs/plugin-react` (with React Compiler via Babel)
- **State**: Zustand 5
- **Router**: React Router 7 (lazy routes)
- **Data Grid**: `@mui/x-data-grid` 9 + `@mui/x-date-pickers`
- **RBAC**: `@casl/react` (frontend CASL)
- **Excel**: `xlsx` library
- **Date**: Dayjs

## Route Map
| Path | Page | Guard |
|------|------|-------|
| `/login` | Login | GuestRoute (redirect if authed) |
| `/register` | Register | GuestRoute |
| `/` | Home (Dashboard) | ProtectedRoute |
| `/users` | Users | ProtectedRoute |
| `/inventory-items` | InventoryItems | ProtectedRoute |
| `/suppliers` | Suppliers | ProtectedRoute |
| `/purchase-orders` | PurchaseOrders | ProtectedRoute |
| `/purchasing-requirements` | PurchasingRequirements | ProtectedRoute |
| `/prices` | Prices | ProtectedRoute |
| `/settings` | Settings | ProtectedRoute |
| `/profile` | Profile | ProtectedRoute |
| `*` | → `/` | Redirect |

## Auth Flow
```
App mount → checkAuth() → POST /api/auth/me
  → 200: set user in store → render protected routes
  → 401: set user=null → show Login
Login → POST /api/auth/login → cookie set → set user → navigate /
401 intercept → POST /api/auth/refresh → retry original request
```

## API Client (`services/api.ts`)
- Base URL from `VITE_API_BASE_URL` env (default `http://localhost:3000`).
- Auto-prefix `/api`.
- `credentials: "include"` for cookie auth.
- Sends `x-client-type: web` header.
- 401 handler: auto-refresh then retry. If refresh fails → logout.
- Methods: `api.apiRequest<T>(url, options)`.

## Auth Store (`store/useAuthStore.ts`)
```
state: { user: User | null, isLoading: boolean }
actions: login(user), logout(), checkAuth(), setLoading(bool)
```

## CASL Permissions (`config/ability.ts`)
| Role | Abilities |
|------|-----------|
| superadmin | `manage` all |
| admin | `read` users, `manage` settings |
| user | `read` settings |

**Known issue**: Sidebar uses subjects (`purchasing-requirements`, `inventory-items`, `suppliers`, `purchase-orders`, `prices`) that aren't in `ability.ts`. Only `manage all` (superadmin) shows them. Admin/user see empty sidebar for those items.

## Theme
- MUI custom theme with purple accent.
- Light/dark toggle persisted in `localStorage` key `userSettings`.
- Dark mode sets `.dark-mode` class on `<html>`.
- Sidebar: dark blue `#1e3a5f` (light), dark gray `#16171d` (dark).

## Key Pages

### PurchasingRequirements (most complex)
- Filter panel: principal selector (grouped by category color), inventory storage, price class, frequency, PO ref, date range.
- DataGrid with dynamic columns (monthly demand per date range).
- Row coloring by principal category (red/orange/blue).
- Editable: Factor and Custom Order columns.
- Toolbar: columns panel, filters, CSV, Print, Excel export.
- State persisted in localStorage.

### Home (Dashboard)
- Summary cards: Immediate Purchase (5), Secondary Purchase (4), Monitoring (1), Total Inventory (11).
- Purchase Requirements by Supplier list.
- Quick Stats + Quick Actions.

## Data Status
- **Real API**: Users list, Profile, Auth (login/register/me/logout).
- **Placeholder**: InventoryItems, Suppliers, PurchaseOrders, PurchasingRequirements, Prices — all hardcoded arrays.
