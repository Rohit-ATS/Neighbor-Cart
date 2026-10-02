FROM node:24-alpine AS build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:24-alpine

ENV PORT=8080
WORKDIR /app
COPY --from=build /app/frontend/dist/ ./frontend/dist/
COPY server.js ./server.js

EXPOSE 8080
CMD ["node", "server.js"]
