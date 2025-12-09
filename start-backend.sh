#!/bin/bash

echo "🚀 Material Manager - Schnellstart"
echo "=================================="
echo ""

# Prüfe MySQL Container
if ! docker ps | grep -q material_manager_mysql; then
    echo "📦 Starte MySQL Container..."
    docker run -d --name material_manager_mysql \
      -p 3306:3306 \
      -e MYSQL_ROOT_PASSWORD=rootpassword \
      -e MYSQL_DATABASE=material_manager \
      -e MYSQL_USER=materialmanager \
      -e MYSQL_PASSWORD=secure_password \
      -v /workspaces/MaterialManager/database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql \
      mysql:8.0
    
    echo "⏳ Warte 15 Sekunden auf MySQL..."
    sleep 15
else
    echo "✅ MySQL Container läuft bereits"
fi

echo ""
echo "🔧 Starte Backend..."
cd /workspaces/MaterialManager/backend

# Installiere Dependencies falls nötig
if [ ! -d "node_modules" ]; then
    echo "📦 Installiere Backend-Dependencies..."
    npm install
fi

# Erstelle .env falls nicht vorhanden
if [ ! -f ".env" ]; then
    cp .env.example .env
    sed -i 's/DB_HOST=mysql/DB_HOST=localhost/g' .env
fi

# Starte Backend im Hintergrund
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend gestartet (PID: $BACKEND_PID)"
echo "   Log: tail -f /tmp/backend.log"

echo ""
echo "═══════════════════════════════════════════════"
echo "✅ Backend läuft auf: http://localhost:3001"
echo "📊 MySQL läuft auf: localhost:3306"
echo ""
echo "📝 NÄCHSTER SCHRITT:"
echo ""
echo "   Das Frontend muss separat installiert werden:"
echo ""
echo "   cd /workspaces/MaterialManager/frontend"
echo "   npm install --legacy-peer-deps"
echo "   npm start"
echo ""
echo "   (Dies öffnet automatisch http://localhost:3000)"
echo ""
echo "═══════════════════════════════════════════════"
echo ""
echo "🛑 Zum Stoppen:"
echo "   Backend: kill $BACKEND_PID"
echo "   MySQL:   docker stop material_manager_mysql"
echo ""
