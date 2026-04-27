# AGENTS.md - Web

## Project Overview

**Frontend** application for the Fullstack Starter template. Built with **React**, **Vite**, **TypeScript**, and **Material-UI**.

## Project Structure (Flat Map)

- `src/main.tsx`: Entry point.
- `src/App.tsx`: Routes and layout.
- `src/utils/api.ts`: API client (fetch wrapper, interceptors).
- `src/providers/AppProvider.tsx`: Theme and context providers.
- `src/store/useAuthStore.ts`: Zustand state for authentication.
- `src/config/ability.ts`: CASL permissions.
- `src/pages/`: Route pages (Home, Login, Users).
- `src/layouts/`: App layout (Sidebar, Header).
- `src/public/`: Static assets.

## Why This Structure?

This follows **separation of concerns**: API logic in `services`, state in `store`, UI in `pages` and `layouts`. DRY principle applied via centralized API client and providers.

## Commands

Check `package.json`:

- `dev`: Start Vite dev server.
- `build`: Compile TS and build for production.
- `lint`: Run ESLint.
- `preview`: Preview production build.
- `typecheck`: Check TypeScript types.

## Naming Conventions

- **Files**: `kebab-case` for config/routes, `PascalCase` for components.
- **Folders**: `kebab-case` (e.g., `auth-routes`).
- **Variables**: `camelCase`.

## Port Configuration

Default port is `5173`. If in use, pass custom port:

```bash
bun run dev -- --port 30001
```

Always use a 5-digit port to avoid conflicts.

## Important Notes

- **NO git operations**: Do not run `git add`, `git commit`, or `git push`.
- **Read Root AGENTS.md**: For general project rules.
- **Read README.md**: For more context on setup and features.
