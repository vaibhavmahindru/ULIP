FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package.json tsconfig.json eslint.config.mjs ./
COPY src ./src

RUN npm install --omit=optional && npm run build

FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# The service only binds to localhost inside the container;
# Nginx or the host will proxy traffic to it.
ENV PORT=4000

CMD ["node", "dist/server.js"]

