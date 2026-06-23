# Build stage
FROM node:22.13.0-alpine AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=
# Google OAuth client ID (build-time — Vite inlines VITE_* at build).
# Override in Coolify as a Build Variable / build arg.
ARG VITE_GOOGLE_CLIENT_ID=712542486332-u45030r72t8nj53u7j6rhoher4cjkb3k.apps.googleusercontent.com
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# nginx template: the official entrypoint runs envsubst on ${BACKEND_URL}
# and writes the result to /etc/nginx/conf.d/default.conf at container start
COPY default.conf.template /etc/nginx/templates/default.conf.template

# Backend address nginx proxies /api & /uploads to. Override in Coolify env.
#   - public domain : BACKEND_URL=https://api.artnesh.cloud  BACKEND_HOST=api.artnesh.cloud
#   - internal name : BACKEND_URL=http://backend:8000        BACKEND_HOST=backend
ENV BACKEND_URL=https://api.artnesh.cloud
ENV BACKEND_HOST=api.artnesh.cloud

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
