# AGENTS.md - Web

## Identity
React frontend for SMR Module. MUI 9, lazy-loaded pages, Zustand state.

## Rules
1. **No root install**: `bun install` in `web/` only.
2. **Lazy load pages**: All route pages must use `React.lazy()` + `Suspense`.
3. **API calls**: Use `services/api.ts` (`api.apiRequest<T>`) — handles auth + refresh.
4. **Auth**: Use `useAuthStore` for user state. Protected routes via `ProtectedRoute` wrapper.
5. **RBAC**: Use `<Can>` component with CASL abilities. Update `config/ability.ts` to add new subjects.
6. **New pages**: Add route in `App.tsx` (lazy import). Place component in `pages/`.
7. **Theme**: Use MUI `sx` prop or theme tokens. Avoid inline styles.
8. **Dark mode**: Respect `userSettings` localStorage. Library handles toggle.
9. **Port**: Default `5173`. Override: `bun run dev -- --port 30001`.
10. **Placeholder data**: Business pages use hardcoded arrays. Replace with real API calls when backend available.
11. **Sidebar nav**: Add new sidebar items in `layouts/AppSidebar.tsx` wrapped in `<Can>`.
12. **New modules**: Mirror existing structure: `store/`, `services/`, `config/`, `pages/`.

## Structure
```
src/
├── main.tsx                    # Entry
├── App.tsx                     # Routes + layout
├── index.css / theme.css       # Global styles
├── config/
│   ├── ability.ts              # CASL definitions
│   └── AbilityProvider.tsx     # CASL provider
├── layouts/
│   ├── AppLayout.tsx           # Sidebar + header + content
│   ├── AppHeader.tsx           # Top bar
│   └── AppSidebar.tsx          # Nav drawer
├── pages/
│   ├── Home.tsx                # Dashboard
│   ├── InventoryItems.tsx      # Placeholder
│   ├── Suppliers.tsx           # Placeholder
│   ├── PurchaseOrders.tsx      # Placeholder
│   ├── PurchasingRequirements.tsx  # Placeholder (largest)
│   ├── Prices.tsx              # Placeholder
│   ├── Users.tsx               # Real API
│   ├── Login.tsx               # Auth form
│   ├── Register.tsx            # Auth form
│   ├── Profile.tsx             # User profile (real API)
│   ├── Settings.tsx            # Dark mode + factor
│   └── Loading.tsx             # Skeleton
├── providers/
│   └── AppProvider.tsx         # Theme + dark mode
├── services/
│   ├── api.ts                  # Fetch wrapper + auto-refresh
│   └── index.ts                # Service re-exports
├── store/
│   └── useAuthStore.ts         # Auth state (Zustand)
└── utils/
    └── exportToExcel.ts        # XLSX export
```

## Commands
- `bun run dev` — Dev server
- `bun run build` — Build for production
- `bun run lint` — ESLint
- `bun run preview` — Preview build
- `bun run typecheck` — Type check

## CASL Subjects
Currently defined: `users`, `settings`, `all`.
When adding sidebar items, ensure subject exists in `ability.ts` or they'll be invisible to non-superadmin.
