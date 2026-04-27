# Fullstack Starter

A modern full-stack starter template built with **Bun**, **Elysia**, **Drizzle ORM**, **React**, **TypeScript**, and **Vite**. This project is designed to provide a robust foundation for building scalable web applications with a clear separation of concerns between the backend and frontend.

## 🚀 Features

- **Backend**: High-performance API using Elysia (Bun), Drizzle ORM (PostgreSQL), JWT Authentication, Role-Based Access Control (RBAC) with CASL, and Swagger documentation.
- **Frontend**: React application with Vite, Material-UI (MUI), Zustand for state management, and React Router.
- **Dev Experience**: Hot reloading, TypeScript, ESLint, and structured project layout.

## 📁 Project Structure

```text
fullstack-starter/
├── api/                  # Backend (Elysia + Drizzle)
│   ├── src/
│   │   ├── config/       # Database configuration
│   │   ├── middlewares/  # Auth, JWT, Rate Limit, CASL, Error handling
│   │   ├── modules/      # Domain logic (Users, Auth, etc.)
│   │   │   └── users/
│   │   │       ├── schema.ts
│   │   │       ├── service.ts
│   │   │       ├── auth.routes.ts
│   │   │       └── users.routes.ts
│   │   └── index.ts      # Server entry
│   ├── drizzle/          # Database migrations
│   └── package.json
├── web/                  # Frontend (React + Vite)
│   ├── src/
│   │   ├── config/       # Ability config (CASL)
│   │   ├── layouts/      # App layout components
│   │   ├── pages/        # Route pages
│   │   ├── providers/    # Context providers (Theme, Auth)
│   │   ├── store/        # Zustand stores
│   │   ├── utils/        # Helpers & API client
│   │   └── App.tsx       # Main app component
│   └── package.json
└── README.md
```

## 🛠 Prerequisites

- **Bun**: [Install Bun](https://bun.sh/docs/installation)
- **Node.js**: v18+ (optional, for npm packages if needed)
- **PostgreSQL**: Local installation or Docker container

## 🚦 Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd fullstack-starter
```

### 2. Install Dependencies

**Root (optional, for workspace management):**
```bash
bun install
```

**Backend:**
```bash
cd api
bun install
```

**Frontend:**
```bash
cd web
bun install
```

### 3. Environment Setup

**Backend (`api/.env`):**
Create a `.env` file in the `api` directory:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=fullstack_db

# JWT Secrets (Generate secure keys for production)
JWT_SECRET=your_jwt_secret
REFRESH_SECRET=your_refresh_secret

# CORS
CORS_ORIGIN=http://localhost:5173
```

**Frontend (`web/.env`):**
Create a `.env` file in the `web` directory:

```env
VITE_API_BASE_URL=http://localhost:3000
```

### 4. Database Setup

1.  Ensure your PostgreSQL server is running.
2.  Generate migrations:
    ```bash
    cd api
    bun run db:generate
    ```
3.  Run migrations:
    ```bash
    bun run db:migrate
    ```

### 5. Running the Project

**Development Mode:**

Open two terminals:

1.  **Backend:**
    ```bash
    cd api
    bun run dev
    ```
    *Runs on `http://localhost:3000`*

2.  **Frontend:**
    ```bash
    cd web
    bun run dev
    ```
    *Runs on `http://localhost:5173`*

**Production Mode:**

1.  **Build Backend:**
    ```bash
    cd api
    bun run build
    bun start
    ```

2.  **Build Frontend:**
    ```bash
    cd web
    bun run build
    bun run preview
    ```

## 📚 Tech Stack

### Backend
- **Runtime**: Bun
- **Framework**: Elysia
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL
- **Authentication**: JWT (Access & Refresh tokens)
- **Authorization**: CASL
- **Documentation**: Swagger (OpenAPI)

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Language**: TypeScript
- **UI Library**: Material-UI (MUI)
- **State Management**: Zustand
- **Routing**: React Router v7
- **Styling**: CSS-in-JS (Emotion)

## ⚙️ Customization

### API Customization
- **Routes**: Modify `api/src/routes.ts` to add new route groups.
- **Modules**: Add new domain modules in `api/src/modules/` (e.g., `products`, `orders`).
- **Database Schema**: Update Drizzle schemas in `api/src/modules/*/schema.ts` and regenerate migrations.

### Web Customization
- **Theming**: Customize the MUI theme in `web/src/providers/AppProvider.tsx`.
- **Routing**: Update routes in `web/src/App.tsx`.
- **API Client**: Modify the API client in `web/src/utils/api.ts` (base URL, interceptors).

### Environment Variables
Refer to the `.env` examples in the "Getting Started" section. Never commit sensitive keys to version control.

## 📖 Documentation

- **API Documentation**: Once the backend is running, visit `http://localhost:3000/api/docs` for the Swagger UI.
- **Frontend**: Check `web/README.md` for frontend-specific details.
- **Backend**: Check `api/README.md` for backend-specific details.

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## 📄 License

This project is licensed under the MIT License.
