# Multi-stage Dockerfile for Agent Backend
# Optimized for Google Cloud Run deployment with WebSocket support

# ========================================
# Stage 1: Dependencies
# ========================================
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files (package-lock.json is required for npm ci)
COPY package.json package-lock.json ./

# Install all dependencies (needed for build stage)
# Use --legacy-peer-deps due to LangChain rapid release cycles
# See: TROUBLESHOOT_BUILD.md for version conflict details
RUN npm ci --legacy-peer-deps && \
    npm cache clean --force

# ========================================
# Stage 2: Build
# ========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy node_modules from deps stage (already has all dependencies)
COPY --from=deps /app/node_modules ./node_modules

# Copy package files
COPY package.json package-lock.json ./

# Copy TypeScript configuration
COPY tsconfig.json ./

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# ========================================
# Stage 3: Runtime
# ========================================
FROM node:20-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 agentuser

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy production dependencies (prune devDependencies)
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --production

# Copy package.json for runtime reference
COPY --from=builder /app/package.json ./

# Set correct permissions
RUN chown -R agentuser:nodejs /app

# Switch to non-root user
USER agentuser

# Expose port (Cloud Run will inject PORT env var)
EXPOSE 8080

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/index.js"]

