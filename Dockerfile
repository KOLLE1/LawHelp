# Multi-stage build for Node.js application
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Build the application
FROM base AS builder
WORKDIR /app
COPY package*.json ./
# Installs all dependencies, including devDependencies for build
# This is crucial because your server-side code (dist/index.js) depends on some devDependencies like @vitejs/plugin-react at runtime.
RUN npm ci
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create a non-root user for security best practices
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only necessary files for the production environment
# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist
# IMPORTANT FIX: Copy all node_modules from the builder stage,
# as it contains both production and development dependencies needed by the server.
COPY --from=builder /app/node_modules ./node_modules
# Copy package.json for potential runtime checks or information, though not strictly necessary for execution if all deps are copied.
COPY --from=builder /app/package*.json ./

# Set permissions for the non-root user
USER nextjs

# Expose the application port
EXPOSE 5000

# Health check to ensure the application is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Command to start the application
CMD ["node", "dist/index.js"]