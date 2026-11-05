# Build stage: has Node.js, and is thrown away after the build.
FROM node:22-alpine AS build
WORKDIR /app

# Install before copying the code, so Docker reuses this step until the
# dependencies change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage: the final image, with only nginx and the built files.
# This nginx image runs as a non-root user and listens on port 8080.
FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
