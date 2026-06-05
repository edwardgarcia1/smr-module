# ---- Build Stage ----
FROM oven/bun:1-alpine AS build

ARG VITE_API_BASE_URL
ARG VITE_APP_NAME
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_APP_NAME=${VITE_APP_NAME}

WORKDIR /app

# Install all dependencies
COPY package.json bun.lock ./
RUN bun install

# Copy project config and source
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts index.html ./
COPY public/ ./public/
COPY src/ ./src/

# Build static assets (tsc -b && vite build)
RUN bun run build

# ---- Runtime Stage ----
FROM nginx:stable-alpine AS runtime

# Copy nginx config with SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
