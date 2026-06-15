# Stage 1: build the frontend static export (Next.js output: 'export' -> out/).
FROM node:24-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: backend.
# Base on the Docker Hub python image and install uv via pip.
# The astral-sh uv image lives on ghcr.io, which fails TLS verification in this
# environment (certificate signed by unknown authority, likely a proxy), while
# docker.io is reachable. uv is still the package manager, just sourced via pip.
FROM python:3.13-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY backend/ ./
RUN uv sync --no-dev

# Serve the built frontend instead of the placeholder page.
COPY --from=frontend /frontend/out ./frontend_dist
ENV STATIC_DIR=/app/frontend_dist

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
