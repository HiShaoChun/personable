# syntax=docker/dockerfile:1.7
# Next.js 15 standalone build。多阶段构建以最小化产物层。

FROM node:20-alpine AS deps
WORKDIR /app
# 仅用 manifest 装依赖，最大化 layer cache 命中
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
# BASE_PATH 在 build 期就需要（next.config.mjs 在 build 时读它生成 basePath + 注入 NEXT_PUBLIC_BASE_PATH）
ARG BASE_PATH=""
ENV BASE_PATH=$BASE_PATH
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# next.config.mjs 里 output:'standalone' 会把 server.js + 最小依赖产到 .next/standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# 本项目没有 public/ 目录，跳过

EXPOSE 3000
CMD ["node", "server.js"]
