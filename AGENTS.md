# AGENTS.md - Root

## Identity
SMR Module — Inventory & Supply Management System.
Bun monorepo: `api/` (backend) + `web/` (frontend).

## Critical Rules
1. **No root install**: `bun install` in `api/` or `web/` only.
2. **Read sub-AGENTS.md first**: Before touching `api/` or `web/`, read their `AGENTS.md`.
3. **No git ops**: No `git add`, `commit`, `push` without explicit instruction.
4. **Port conflicts**: Use 5-digit port (e.g., `30001`). Pass via env or inline.
5. **Follow existing patterns**: Do not create arbitrary folders. Mirror existing module structure.
6. **Read CONTEXT.md**: For project understanding, read `CONTEXT.md`, `api/CONTEXT.md`, `web/CONTEXT.md`.

## Naming
- Files: `kebab-case` for config/routes, `PascalCase` for components.
- Folders: `kebab-case`.
- Variables: `camelCase`.

## Commands
- Backend: `cd api && bun run dev`
- Frontend: `cd web && bun run dev`
- DB migrate: `cd api && bun run db:migrate`

## Reading Order
1. `CONTEXT.md` — Project overview
2. `api/CONTEXT.md` — Backend architecture
3. `web/CONTEXT.md` — Frontend architecture
4. `api/AGENTS.md` — Backend rules
5. `web/AGENTS.md` — Frontend rules
