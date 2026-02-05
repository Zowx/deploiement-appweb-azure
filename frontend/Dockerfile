# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Build argument for API URL (can be overridden at build time)
ARG VITE_API_URL=https://app-cloudazure-backend-dev.azurewebsites.net/api/files
ENV VITE_API_URL=$VITE_API_URL

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --prefer-offline

# Copy source and build
COPY . .
RUN npm run build

# Production stage - using serve
FROM node:20-alpine AS runner

WORKDIR /app

# Install serve
RUN npm install -g serve

# Copy built files
COPY --from=builder /app/dist ./dist

EXPOSE 8080

# Start serve on port 8080
CMD ["serve", "-s", "dist", "-l", "8080"]
