# syntax=docker/dockerfile:1

# ==============================================================================
# Stage 1: Install dependencies (Debian-based Node 20 for bcrypt & Prisma glibc)
# ==============================================================================
FROM node:20-bookworm-slim AS deps
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ==============================================================================
# Stage 2: Generate Prisma Client & Build Next.js 15 Production Bundle
# ==============================================================================
FROM node:20-bookworm-slim AS builder
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# ==============================================================================
# Stage 3: Production Runner (Next.js + Prisma CLI for isolated schema migration)
# ==============================================================================
FROM node:20-bookworm-slim AS runner
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV STORAGE_DIR=/app/storage/uploads

RUN mkdir -p /app/storage/uploads

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

CMD ["npm", "start"]
