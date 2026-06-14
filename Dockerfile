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
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server-bot.ts ./server-bot.ts
COPY --from=builder /app/src/types.ts ./src/types.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
RUN npm install tsx
RUN touch bot-config-store.json bot-logs-store.json bot-users-store.json
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npx", "tsx", "server.ts"]
