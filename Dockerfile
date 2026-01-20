FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN chown -R node:node /app
USER node
EXPOSE 4200
CMD ["npm","run","start"]
