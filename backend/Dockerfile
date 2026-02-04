# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci --prefer-offline

# Generate Prisma client
RUN npx prisma generate

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Install only production dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --prefer-offline --omit=dev

# Generate Prisma client in production image
RUN npx prisma generate

# Copy built application
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the app directly (prisma db push done via Azure startup command)
CMD ["node", "dist/index.js"]
