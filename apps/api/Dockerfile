# Built from the repo root, since the API needs the workspace packages:
#   docker build -f apps/api/Dockerfile --build-arg CODE_VERSION=$(git rev-parse --short HEAD) .
FROM node:22-slim

WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter "@oraqul/api..." \
  && pnpm turbo run build --filter "@oraqul/api..."

ARG CODE_VERSION=""
ENV NODE_ENV=production CODE_VERSION=${CODE_VERSION}
WORKDIR /app/apps/api
EXPOSE 4000
# Migrations run on every start. Drizzle skips the ones already applied.
CMD ["sh", "-c", "pnpm db:migrate && node dist/main.js"]
