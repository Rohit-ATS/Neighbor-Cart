FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM node:24-alpine

ENV PORT=8080
WORKDIR /app
COPY --from=build /app/dist/ ./dist/
COPY server.js ./server.js

EXPOSE 8080
CMD ["node", "server.js"]
