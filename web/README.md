# Web

Frontend application for the Fullstack Starter template. Built with **React**, **Vite**, **TypeScript**, and **Material-UI**.

## 🛠 Prerequisites

- **Bun**: v1.1+ (or Node.js)
- **API Backend**: Running instance of the API service

## 🚦 Getting Started

### Installation

```bash
bun install
```

### Environment

Create a `.env` file in the root of this directory:

```env
VITE_API_BASE_URL=http://localhost:3000
```

### Running

**Development:**

```bash
bun run dev
```

**Production:**

```bash
bun run build
bun run preview
```

## 📂 Project Structure

```text
web/
├── src/
│   ├── assets/            # Static assets (images, icons)
│   ├── config/
│   │   ├── ability.ts     # CASL ability rules
│   │   └── AbilityProvider.tsx
│   ├── layouts/           # App layout components (Sidebar, Header)
│   ├── pages/             # Route pages (Home, Login, Users, etc.)
│   ├── providers/         # Context providers (Theme)
│   ├── store/             # Zustand state stores
│   ├── utils/             # Helpers & API client
│   │   └── api.ts
│   ├── App.tsx            # Main app with routing
│   ├── main.tsx           # Entry point
│   └── index.css          # Global styles
├── public/                # Static files
└── package.json
```

## 📜 Scripts

- `dev`: Start Vite dev server.
- `build`: Compile TypeScript and build for production.
- `lint`: Run ESLint.
- `preview`: Preview production build.
- `typecheck`: Check TypeScript types.

## 🛡️ Authentication & RBAC

### Auth State

- Managed by **Zustand** (`useAuthStore`).
- Persists session via API calls (`/auth/me`).
- Handles token refresh automatically via `api.ts`.

### Permissions

- **CASL** is used for UI permissions (e.g., hiding elements).
- Rules defined in `src/config/ability.ts`.
- Provider wraps the app in `src/config/AbilityProvider.tsx`.

## 🎨 Styling & UI

- **Material-UI (MUI)**: Primary UI library.
- **Theme**: Customizable via `ThemeProvider` in `src/providers/AppProvider.tsx`.
- **Dark Mode**: Supported via context and local storage persistence.

## 🔌 API Integration

The `api.ts` utility handles all backend communication:

- **Base URL**: Configured via `VITE_API_BASE_URL`.
- **Credentials**: Includes cookies (`credentials: 'include'`).
- **Refresh Token**: Intercepts 401 errors to refresh tokens automatically.

## 🚦 Routing

- **React Router v7**: Used for client-side routing.
- **Protected Routes**: Handled by `ProtectedRoute` component in `App.tsx`.
- **Lazy Loading**: Pages are lazy-loaded for better performance.
