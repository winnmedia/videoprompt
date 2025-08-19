FROM node:20.19-bullseye AS builder

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_CACHE=/tmp/.npm

COPY package*.json ./
RUN npm ci

COPY . .

# Prisma generate at build time (dev deps available in builder)
RUN npm run prisma:generate

# Build Next.js
RUN npm run build

FROM node:20.19-bullseye AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_CACHE=/tmp/.npm \
    PORT=3000

# Copy artifacts and node_modules from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Remove dev dependencies while preserving generated client
RUN npm prune --production

EXPOSE 3000

CMD ["npm", "run", "start"]

