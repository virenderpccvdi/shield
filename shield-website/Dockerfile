FROM nginx:1.27-alpine

# Copy website files
COPY . /usr/share/nginx/html/

# Copy nginx site config (avoids heredoc — not supported without BuildKit on all runners)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create download directory for APK (populated by CI after flutter build)
RUN mkdir -p /usr/share/nginx/html/download

EXPOSE 80
