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
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# nginx template: the official entrypoint runs envsubst on ${BACKEND_URL}
# and writes the result to /etc/nginx/conf.d/default.conf at container start
COPY default.conf.template /etc/nginx/templates/default.conf.template

# Internal hostname of the backend service. Override in Coolify env if different.
ENV BACKEND_URL=http://backend:8000

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
