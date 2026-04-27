# AGENTS.md - API

## Project Overview
**Backend** service for the Fullstack Starter template. Built with **Elysia**, **Drizzle ORM**, and **Bun**.

## Project Structure (Flat Map)
- `src/index.ts`: Server entry point.
- `src/routes.ts`: Route aggregation.
- `src/config/db.ts`: Database connection.
- `src/middlewares/`: Auth, JWT, Rate Limit, CASL, Error handling.
- `src/modules/users/`: User domain (schema, service, routes).
- `drizzle/`: Database migrations.
- `package.json`: Dependencies and scripts.

## Why This Structure?
This follows **domain-driven design**: Each module (e.g., `users`) contains its own schema, service, and routes. Centralized config and middleware keep logic DRY.

## Commands
Check `package.json`:
- `dev`: Start development server with hot reload.
- `build`: Build for production.
- `start`: Run production build.
- `test`: Run tests.
- `typecheck`: Check TypeScript types.
- `db:generate`: Generate Drizzle migrations.
- `db:migrate`: Run pending migrations.

## Naming Conventions
- **Files**: `kebab-case` for config/routes, `PascalCase` for components.
- **Folders**: `kebab-case` (e.g., `auth-routes`).
- **Variables**: `camelCase`.

## Port Configuration
Default port is `3000`. If in use, pass custom port via environment variable:
```bash
PORT=30001 bun run dev
```
Always use a 5-digit port to avoid conflicts.

## Important Notes
- **NO git operations**: Do not run `git add`, `git commit`, or `git push`.
- **Read Root AGENTS.md**: For general project rules.
- **Read README.md**: For more context on setup and features.
