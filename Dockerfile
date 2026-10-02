FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM python:3.12-alpine

ENV PORT=8080
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=build /app/dist/ ./dist/
COPY api/ ./api/
COPY server.py ./

EXPOSE 8080
# server.py, not api.app: api.app serves only /api/* and /healthz and 404s on
# every other path, so running it directly left the deployed site returning
# {"error":"Route not found"} at the root. server.py wraps the same handler and
# serves the built dist/ bundle with SPA fallback.
CMD ["python3", "server.py"]
