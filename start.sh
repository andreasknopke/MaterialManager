# Start-Skript für das Material Manager System

echo "🚀 Material Manager wird gestartet..."
echo ""

# Prüfe ob Docker läuft
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker ist nicht gestartet. Bitte starten Sie Docker und versuchen Sie es erneut."
    exit 1
fi

# Prüfe ob docker-compose verfügbar ist
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose ist nicht installiert."
    exit 1
fi

# Stoppe eventuell laufende Container
echo "🛑 Stoppe alte Container..."
docker-compose down

# Starte alle Services
echo "🏗️  Starte Services..."
docker-compose up -d

# Warte auf MySQL
echo "⏳ Warte auf MySQL-Datenbank..."
sleep 10

# Zeige Status
echo ""
echo "✅ Material Manager erfolgreich gestartet!"
echo ""
echo "📍 Zugriff:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:3001"
echo "   MySQL:     localhost:3306"
echo ""
echo "📊 Status anzeigen:       docker-compose ps"
echo "📋 Logs anzeigen:         docker-compose logs -f"
echo "🛑 System stoppen:        docker-compose down"
echo ""
