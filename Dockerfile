# Stage 1: Base
# Node 24 (LTS). Node 20 quedó sin soporte en abril de 2026. Solo compila el
# frontend: la imagen final es nginx, sin Node.
FROM node:24-alpine AS base
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

# Stage 4: Production (Nginx sin root)
FROM nginxinc/nginx-unprivileged:alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=builder /app/dist/*/browser /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
