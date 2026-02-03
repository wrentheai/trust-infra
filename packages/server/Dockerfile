FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json* tsconfig.base.json ./

# Copy all packages
COPY packages ./packages

# Install dependencies
RUN npm ci

# Build all packages
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy workspace root
COPY package.json package-lock.json* ./

# Copy built packages
COPY --from=builder /app/packages/crypto/dist ./packages/crypto/dist
COPY --from=builder /app/packages/crypto/package.json ./packages/crypto/
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/

# Copy migrations
COPY migrations ./migrations

# Install production dependencies only
RUN npm ci --production --workspace=@trust-infra/server

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "packages/server/dist/index.js"]
