FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
RUN touch bot-config-store.json bot-logs-store.json bot-users-store.json
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/server.cjs"]
