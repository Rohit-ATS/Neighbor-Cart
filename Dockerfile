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

EXPOSE 8080
CMD ["python3", "-m", "api.app"]
