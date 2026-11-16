# Two stages: npm is needed to install dependencies but never at run time, so the final
# image does not contain it (or its own dependencies, which carried the vulnerabilities
# the image scan reported on 16 Nov 2026). Both stages are pinned by digest; Dependabot
# proposes updates weekly.
FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5
ENV NODE_ENV=production
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.mjs tutor-curriculum.mjs tutor-investigations.mjs capstone-policy.mjs ./
USER node
EXPOSE 8080
CMD ["node","server.mjs"]
