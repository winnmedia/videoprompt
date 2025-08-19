FROM node:20.19-bullseye AS builder

WORKDIR /app

ENV NODE_ENV=production \
    NPM_CONFIG_CACHE=/tmp/.npm

COPY package*.json ./
RUN npm ci

COPY . .

# Prisma generate at build time
RUN npm run prisma:generate

# Build Next.js
RUN npm run build

FROM node:20.19-bullseye AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NPM_CONFIG_CACHE=/tmp/.npm \
    PORT=3000

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["npm", "run", "start"]

