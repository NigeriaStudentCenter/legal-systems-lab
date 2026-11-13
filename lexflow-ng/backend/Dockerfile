FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /srv/lexflow
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY src ./src
USER node
EXPOSE 8080
CMD ["node","src/main.mjs"]
