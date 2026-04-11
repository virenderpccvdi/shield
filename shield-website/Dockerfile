FROM nginx:1.29-alpine

# Apply latest Alpine security patches (CVE-2026-34757 libpng, CVE-2026-40200 musl)
RUN apk upgrade --no-cache

# Copy website files
COPY . /usr/share/nginx/html/

# Copy nginx site config (avoids heredoc — not supported without BuildKit on all runners)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create download directory for APK (populated by CI after flutter build)
RUN mkdir -p /usr/share/nginx/html/download

EXPOSE 80
