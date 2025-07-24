
FROM node:22-alpine AS admin-build
WORKDIR /app

COPY admin/ ./
RUN yarn install --frozen-lockfile

RUN yarn build

FROM node:22-alpine AS api-build
WORKDIR /app

COPY api/ ./
RUN yarn install --frozen-lockfile

RUN yarn build:docker

FROM node:22-alpine AS final

WORKDIR /app

RUN apk --no-cache add gcompat

COPY --from=api-build /app/dist ./dist
COPY --from=api-build /app/node_modules/.prisma ./node_modules/.prisma

COPY --from=admin-build /app/dist ./static

COPY api/package.json api/yarn.lock ./
RUN yarn install --frozen-lockfile --production && \
    yarn cache clean

EXPOSE 3000
CMD ["yarn", "start"]
