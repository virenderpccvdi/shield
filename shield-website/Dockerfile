FROM nginx:alpine

# Copy website files
COPY . /usr/share/nginx/html/

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

    # APK download
    location ~* \.apk$ {
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
