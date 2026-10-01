FROM node:22.22.3-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY src ./src
COPY assets ./assets
COPY server ./server
COPY index.html tsconfig.json vite.config.ts ./
RUN npm run build && npm run build:server

FROM node:22.22.3-bookworm-slim
LABEL org.opencontainers.image.title="LINE MTC" \
      org.opencontainers.image.source="https://github.com/9vibes/LINE-MTC" \
      org.opencontainers.image.description="Shared aircraft running log and Even G2 companion"
WORKDIR /app
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/server-build ./server-build
RUN mkdir /data && chown node:node /data
USER node
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/line-mtc.sqlite TZ=America/New_York
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server-build/main.mjs"]
