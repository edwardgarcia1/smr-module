# AGENTS.md - Root

## Project Overview
Fullstack Starter template with **Bun** monorepo: **Backend** (`api/`) and **Frontend** (`web/`).

## ⚠️ CRITICAL Rules
1. **NO package installation in root**: Run `bun install` only in `api/` or `web/` directories.
2. **Read Sub-AGENTS.md**: When working on `api/` or `web/`, read `./AGENTS.md` inside those folders first.
3. **No Git Operations**: Do not run `git add`, `git commit`, or `git push` without explicit user instruction.
4. **Port Conflicts**: When starting servers, use a 5-digit port (e.g., `30000`) if the default is in use. Pass port via environment variable or inline command.
5. **Use Existing Patterns**: Follow structure in `api/` and `web/`. Do not create arbitrary folders.

## File Structure
```text
fullstack-starter/
├── api/          # Backend (Elysia + Drizzle + Bun)
├── web/          # Frontend (React + Vite + MUI)
├── README.md     # Project documentation
├── AGENTS.md     # This file
└── .env          # (Optional) Global vars (avoid secrets)
```

## Commands & Purposes
- **Backend**: `cd api && bun run dev` (Start API), `bun run build` (Build).
- **Frontend**: `cd web && bun run dev` (Start Vite), `bun run build` (Build).
- **Database**: `cd api && bun run db:generate`, `bun run db:migrate`.

## Naming Conventions
- **Files**: `kebab-case` for config/routes, `PascalCase` for components.
- **Folders**: `kebab-case` (e.g., `auth-routes`).
- **Variables**: `camelCase`.

## Reading Guide
1. Check `./README.md` for general setup.
2. Check `./api/AGENTS.md` for backend specifics.
3. Check `./web/AGENTS.md` for frontend specifics.
