# API

Backend service for the Fullstack Starter template. Built with **Elysia**, **Drizzle ORM**, and **Bun**.

## 🛠 Prerequisites

- **Bun**: v1.1+
- **PostgreSQL**: Running instance

## 🚦 Getting Started

### Installation

```bash
bun install
```

### Environment

Create a `.env` file in the root of this directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=fullstack_db
JWT_SECRET=secret
REFRESH_SECRET=secret
CORS_ORIGIN=http://localhost:5173
```

### Running

**Development:**

```bash
bun run dev
```

**Production:**

```bash
bun run build
bun start
```

## 📂 Project Structure

```text
api/
├── src/
│   ├── config/
│   │   └── db.ts           # Database connection
│   ├── middlewares/
│   │   ├── auth.ts         # Auth guard
│   │   ├── casl.ts         # RBAC middleware
│   │   ├── error.ts        # Error handling
│   │   ├── jwt.ts          # JWT setup
│   │   └── rateLimit.ts    # Rate limiting
│   ├── modules/
│   │   └── users/          # User domain
│   │       ├── auth.routes.ts
│   │       ├── users.routes.ts
│   │       ├── schema.ts   # Drizzle schema
│   │       └── service.ts  # Business logic
│   ├── shared/
│   │   └── auth.ts         # Shared auth helpers
│   ├── index.ts            # Server entry
│   └── routes.ts           # Route aggregation
├── drizzle/                # Migrations
└── package.json
```

## 📜 Scripts

- `dev`: Start development server with hot reload.
- `build`: Build for production.
- `start`: Run production build.
- `test`: Run tests (Bun test runner).
- `typecheck`: Check TypeScript types.
- `db:generate`: Generate Drizzle migrations.
- `db:migrate`: Run pending migrations.

## 🛡️ Authentication & Authorization

### JWT Strategy

- **Access Token**: Short-lived (15 min), stored in cookies (httpOnly) or returned for mobile clients.
- **Refresh Token**: Long-lived (7 days), stored in cookies, used to rotate access tokens.

### RBAC (Role-Based Access Control)

- Uses **CASL** for permission management.
- Roles: `superadmin`, `admin`, `user`.
- Permissions defined in `src/modules/users/service.ts` (conceptually) or middleware logic.

## 📡 API Endpoints

### Auth

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/me` - Get current user profile

### Users

- `GET /api/users` - List all users (Admin only)
- `GET /api/users/profile` - Get current user profile

## 🗄️ Database

### Migrations

1.  Update schema in `src/modules/*/schema.ts`.
2.  Generate migration:
    ```bash
    bun run db:generate
    ```
3.  Apply migration:
    ```bash
    bun run db:migrate
    ```

## 🔧 Configuration

- **CORS**: Configured in `src/index.ts`.
- **Rate Limiting**: Configured in `src/middlewares/rateLimit.ts`.
- **Swagger**: Available at `/api/docs` when running.
