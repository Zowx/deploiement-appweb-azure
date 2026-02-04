# Build stage
FROM node:20-alpine AS builder

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

# Production stage - using nginx for better performance
FROM nginx:alpine AS runner

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 (nginx default, expected by Azure)
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
