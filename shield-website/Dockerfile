FROM nginx:1.27-alpine

# Copy website files
COPY . /usr/share/nginx/html/

# Create download directory for APK (populated by CI after flutter build)
RUN mkdir -p /usr/share/nginx/html/download

# Custom nginx config for SPA + static files
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # React SPA entry point — never cache so users always get latest chunks
    location = /app/index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        try_files $uri /app/index.html;
    }

    # Hashed JS/CSS assets — cache forever (hash changes on each deploy)
    location ~* /app/assets/.*\.(js|css|woff2?|ttf|eot|svg|png|jpg|ico)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # React app at /app/ — fallback to SPA index
    location /app/ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        try_files $uri $uri/ /app/index.html;
    }

    # APK download — /download/ clean URL
    location /download/ {
        add_header Content-Type "application/vnd.android.package-archive";
        add_header Content-Disposition 'attachment; filename="shield-app.apk"';
        add_header X-Content-Type-Options nosniff;
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, HEAD, OPTIONS';
        try_files $uri =404;
    }

    # Legacy APK direct download (regex catch)
    location ~* \.apk$ {
        add_header Content-Type "application/vnd.android.package-archive";
        add_header Content-Disposition "attachment";
    }

    # Static files (website landing pages)
    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
}
EOF

EXPOSE 80
