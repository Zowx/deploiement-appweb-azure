# Build stage
FROM --platform=linux/amd64 node:20-alpine AS builder

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

# Production stage - using node + serve
FROM --platform=linux/amd64 node:20-alpine AS runner

WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy built files
COPY --from=builder /app/dist ./dist

ENV PORT=80

EXPOSE 80

# Start serve on port 80
CMD ["serve", "-s", "dist", "-l", "80"]
