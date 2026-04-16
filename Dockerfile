# Stage 1: Base
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# Stage 2: Development
FROM base AS dev
COPY . .
RUN chown -R node:node /app
USER node
EXPOSE 4200
CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--poll", "2000"]

# Stage 3: Builder (for production)
FROM base AS builder
COPY . .
RUN npm run build -- --configuration production

# Stage 4: Production (Nginx)
FROM nginx:alpine AS prod
# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy built Angular app from builder stage
COPY --from=builder /app/dist/*/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
