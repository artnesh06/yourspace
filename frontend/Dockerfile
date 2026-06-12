# Build stage
FROM node:22.13.0-alpine AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Optional: custom error pages or config can be added here if needed
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
