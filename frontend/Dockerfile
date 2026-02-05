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

# Production stage - using nginx
FROM nginx:alpine AS runner

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
RUN echo 'server { \
    listen 8080; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
