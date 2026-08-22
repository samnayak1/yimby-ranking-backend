# ---- build: needs devDependencies (typescript) ----
FROM node:22 AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

ENV NODE_OPTIONS=--max-old-space-size=512
RUN npm run build


# ---- runtime: production deps only ----
FROM node:22 AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

# Reinstalled rather than copied from the build stage so better-sqlite3's native
# binding is compiled against this image.
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Applied on boot by runMigrations(), so they ship with the runtime image.
COPY drizzle ./drizzle

# Read at startup by src/config/config.ts.
COPY config ./config

RUN mkdir -p /app/db /app/backups && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]
