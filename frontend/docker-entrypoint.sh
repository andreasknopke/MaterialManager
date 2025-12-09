#!/bin/sh

echo "==================================="
echo "Frontend Container Starting"
echo "==================================="

# Replace PORT placeholder in nginx config if PORT env var is set
if [ -n "$PORT" ]; then
    echo "Setting nginx to listen on port $PORT"
    sed -i "s/listen 80;/listen $PORT;/g" /etc/nginx/conf.d/default.conf
else
    echo "Using default port 80"
fi

# Replace BACKEND_URL placeholder with actual backend URL
if [ -n "$BACKEND_URL" ]; then
    echo "Setting BACKEND_URL to: $BACKEND_URL"
    sed -i "s|\${BACKEND_URL}|$BACKEND_URL|g" /etc/nginx/conf.d/default.conf
else
    echo "ERROR: BACKEND_URL not set! Using fallback http://localhost:3001"
    sed -i "s|\${BACKEND_URL}|http://localhost:3001|g" /etc/nginx/conf.d/default.conf
fi

echo "==================================="
echo "Nginx configuration:"
echo "==================================="
cat /etc/nginx/conf.d/default.conf
echo "==================================="

# Start nginx
echo "Starting nginx..."
exec nginx -g 'daemon off;'
