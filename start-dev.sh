#!/bin/bash

echo "🚀 Material Manager - Entwicklungsstart (ohne Docker)"
echo ""

# Prüfe ob MySQL läuft (optional, falls lokal vorhanden)
if command -v mysql &> /dev/null; then
    echo "ℹ️  MySQL gefunden - Sie können die lokale Datenbank verwenden"
    echo "   Oder starten Sie nur die MySQL-Datenbank mit:"
    echo "   docker run -d --name material_manager_mysql -p 3306:3306 \\"
    echo "     -e MYSQL_ROOT_PASSWORD=rootpassword \\"
    echo "     -e MYSQL_DATABASE=material_manager \\"
    echo "     -e MYSQL_USER=materialmanager \\"
    echo "     -e MYSQL_PASSWORD=secure_password \\"
    echo "     mysql:8.0"
    echo ""
fi

# Backend starten
echo "🔧 Starte Backend..."
cd backend

if [ ! -d "node_modules" ]; then
    echo "📦 Installiere Backend-Dependencies..."
    npm install
fi

if [ ! -f ".env" ]; then
    echo "⚙️  Erstelle .env Datei..."
    cp .env.example .env
    # Für lokale Entwicklung
    sed -i 's/DB_HOST=mysql/DB_HOST=localhost/g' .env 2>/dev/null || sed -i '' 's/DB_HOST=mysql/DB_HOST=localhost/g' .env
fi

echo "▶️  Backend startet auf Port 3001..."
npm run dev &
BACKEND_PID=$!

cd ..

# Frontend starten
echo "🎨 Starte Frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "📦 Installiere Frontend-Dependencies..."
    npm install --legacy-peer-deps
fi

if [ ! -f ".env" ]; then
    echo "⚙️  Erstelle .env Datei..."
    cp .env.example .env
fi

echo "▶️  Frontend startet auf Port 3000..."
npm start &
FRONTEND_PID=$!

cd ..

echo ""
echo "✅ Material Manager läuft!"
echo ""
echo "📍 Zugriff:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:3001"
echo ""
echo "⚠️  Hinweis: Stellen Sie sicher, dass MySQL auf Port 3306 läuft"
echo "   und initialisieren Sie die Datenbank mit: mysql -u root -p < database/schema.sql"
echo ""
echo "🛑 Zum Beenden: Ctrl+C drücken"
echo ""

# Warte auf Benutzer-Interrupt
wait
