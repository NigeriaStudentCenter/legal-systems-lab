# Pinned by digest; Dependabot proposes updates weekly.
FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force
COPY server.mjs ./
USER node
EXPOSE 8080
CMD ["node","server.mjs"]
