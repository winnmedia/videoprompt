FROM node:20.19-bullseye AS builder

WORKDIR /app

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/usr/local/share/pnpm \
    PATH="$PNPM_HOME:$PATH"

# Enable corepack and use pnpm
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# Copy manifests
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Prisma generate at build time (dev deps available in builder)
RUN pnpm prisma:generate

# Build Next.js (force production mode during build)
RUN NODE_ENV=production pnpm build

FROM node:20.19-bullseye AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    PNPM_HOME=/usr/local/share/pnpm \
    PATH="$PNPM_HOME:$PATH"

# Copy artifacts and node_modules from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# No prune step needed; node_modules already built with production deps

EXPOSE 3000

CMD ["pnpm", "start"]

