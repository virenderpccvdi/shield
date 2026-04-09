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

    # React app at /app/
    location /app/ {
        try_files $uri $uri/ /app/index.html;
    }

    # APK download
    location ~* \.apk$ {
        add_header Content-Disposition "attachment";
    }

    # Static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
}
EOF

EXPOSE 80
