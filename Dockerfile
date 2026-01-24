# Stage 1: Base
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

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

# Stage 4: Production (Nginx) - Optional for future use
# FROM nginx:alpine AS prod
# COPY --from=builder /app/dist/*/browser /usr/share/nginx/html
# EXPOSE 80
# CMD ["nginx", "-g", "daemon off;"]
