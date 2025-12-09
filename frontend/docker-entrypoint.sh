#!/bin/sh

# Replace PORT placeholder in nginx config if PORT env var is set
if [ -n "$PORT" ]; then
    sed -i "s/listen 80;/listen $PORT;/g" /etc/nginx/conf.d/default.conf
fi

# Replace BACKEND_URL placeholder with actual backend URL
if [ -n "$BACKEND_URL" ]; then
    sed -i "s|\${BACKEND_URL}|$BACKEND_URL|g" /etc/nginx/conf.d/default.conf
else
    echo "WARNING: BACKEND_URL not set, using default http://localhost:3001"
    sed -i "s|\${BACKEND_URL}|http://localhost:3001|g" /etc/nginx/conf.d/default.conf
fi

# Start nginx
exec nginx -g 'daemon off;'
