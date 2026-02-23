# ── Stage 1: Build ──────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Stage 2: Production ────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3100
ENV HOST=0.0.0.0
ENV DATABASE_URL=/app/data/qr-agent.db

EXPOSE 3100

# Health check for container orchestrators
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:3100/health || exit 1

CMD ["node", "dist/server.js"]
