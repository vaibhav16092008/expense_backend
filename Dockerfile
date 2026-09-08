# ==============================================================================
# Multi-stage Dockerfile for ExpenseIQ Backend API
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Compile TypeScript
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency specifications and Prisma schema
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for compilation)
RUN npm ci

# Copy application source code and OpenAPI spec
COPY src ./src
COPY docs/openapi.yaml ./docs/openapi.yaml

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript to dist/
RUN npm run build

# Prune devDependencies to keep production image lightweight
RUN npm prune --production

# ------------------------------------------------------------------------------
# Stage 2: Minimal Production Runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install curl for container HEALTHCHECK
RUN apk add --no-cache curl

# Copy compiled build output, production dependencies, and required runtime assets
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/docs/openapi.yaml ./docs/openapi.yaml

# Use non-root node user for container security
USER node

EXPOSE 5000

# Container Healthcheck probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health/live || exit 1

# Start production server
CMD ["node", "dist/server.js"]
