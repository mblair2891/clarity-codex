FROM node:20-alpine AS base
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN npm install
COPY . .
RUN npm run build -w @clarity/domain && npm run build -w @clarity/web

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/apps/web/.next/standalone ./
COPY --from=base /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=base /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "server.js"]
