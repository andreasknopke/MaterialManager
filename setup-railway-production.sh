#!/bin/bash
# Railway Production Setup Script
# Führt alle notwendigen Schritte für Railway-Deployment aus

set -e  # Bei Fehler stoppen

echo "🚂 Railway Production Setup"
echo "================================"
echo ""

# Farben für Output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Prüfe ob RAILWAY_BACKEND_URL gesetzt ist
if [ -z "$RAILWAY_BACKEND_URL" ]; then
    echo -e "${YELLOW}⚠️  RAILWAY_BACKEND_URL nicht gesetzt${NC}"
    echo "Bitte setze die Variable:"
    echo "  export RAILWAY_BACKEND_URL=https://deine-backend-url.up.railway.app"
    exit 1
fi

echo "📡 Backend URL: $RAILWAY_BACKEND_URL"
echo ""

# 1. Health Check
echo "1️⃣  Prüfe Backend Erreichbarkeit..."
if curl -s -f "$RAILWAY_BACKEND_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ Backend erreichbar${NC}"
else
    echo -e "${RED}❌ Backend nicht erreichbar${NC}"
    exit 1
fi
echo ""

# 2. Root-Passwort initialisieren
echo "2️⃣  Initialisiere Root-User Passwort..."
RESPONSE=$(curl -s -X POST "$RAILWAY_BACKEND_URL/api/admin/update-root-password")
if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Root-Passwort gesetzt${NC}"
    echo "$RESPONSE" | grep -o '"message":"[^"]*"'
else
    echo -e "${YELLOW}⚠️  Konnte Root-Passwort nicht setzen${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

# 3. Test Login
echo "3️⃣  Teste Root-Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$RAILWAY_BACKEND_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"root","password":"root"}')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✅ Login erfolgreich${NC}"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "Token erhalten (gekürzt): ${TOKEN:0:50}..."
else
    echo -e "${RED}❌ Login fehlgeschlagen${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi
echo ""

# 4. Prüfe User-Daten
echo "4️⃣  Prüfe User-Informationen..."
USER_INFO=$(echo "$LOGIN_RESPONSE" | grep -o '"user":{[^}]*}')
echo "$USER_INFO"
echo ""

# 5. Prüfe Units (Departments)
echo "5️⃣  Prüfe Departments..."
UNITS=$(curl -s -H "Authorization: Bearer $TOKEN" "$RAILWAY_BACKEND_URL/api/units")
UNIT_COUNT=$(echo "$UNITS" | grep -o '"id":' | wc -l)
if [ "$UNIT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ $UNIT_COUNT Departments gefunden${NC}"
else
    echo -e "${YELLOW}⚠️  Keine Departments gefunden - bitte Migration ausführen${NC}"
fi
echo ""

# 6. Setup-Status
echo "================================"
echo "🎉 Railway Setup abgeschlossen!"
echo ""
echo "📋 Nächste Schritte:"
echo "  1. Login: https://DEINE-FRONTEND-URL.up.railway.app"
echo "  2. Credentials: root / root"
echo "  3. Passwort ändern (wird erzwungen)"
echo "  4. Department Admins anlegen"
echo ""
echo "📚 Dokumentation: RAILWAY_PRODUCTION_SETUP.md"
echo "================================"
