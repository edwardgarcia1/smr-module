# ---- Build Stage ----
FROM oven/bun:1-alpine AS build

WORKDIR /app

# Install all dependencies
COPY package.json bun.lock ./
RUN bun install

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Bundle the application for Bun runtime
RUN bun build src/index.ts --target=bun --outfile=./dist/index.js

# ---- Runtime Stage ----
FROM oven/bun:1-alpine AS runtime

WORKDIR /app

# Copy node_modules from build stage (avoids a second bun install
# and works around Bun --production implicitly freezing the lockfile).
# Dev-only type packages (@types/*) are harmless at runtime.
COPY --from=build /app/node_modules ./node_modules

# Copy the pre-built bundle
COPY --from=build /app/dist ./dist

# Data directory for runtime CSV files (POs, Solomon imports).
# Mount a persistent volume here at deploy time.
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 3000

ENV NODE_ENV=production

CMD ["bun", "dist/index.js"]
