#!/bin/bash

echo "🧪 Mistral AI Integration Test"
echo "================================"
echo ""

# Farben für Output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Prüfe ob API Key gesetzt ist
if [ -z "$MISTRAL_API_KEY" ]; then
    echo -e "${RED}✗ MISTRAL_API_KEY nicht gesetzt${NC}"
    echo ""
    echo "Bitte setzen Sie den API Key:"
    echo "export MISTRAL_API_KEY='your_key_here'"
    exit 1
fi

echo -e "${GREEN}✓ MISTRAL_API_KEY ist gesetzt${NC}"
echo ""

# Prüfe Dependencies
echo "📦 Prüfe Dependencies..."
cd backend

if ! npm list @mistralai/mistralai > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ @mistralai/mistralai nicht installiert${NC}"
    echo "Installiere Dependencies..."
    npm install
else
    echo -e "${GREEN}✓ Mistral SDK installiert${NC}"
fi

echo ""

# TypeScript Kompilierung prüfen
echo "🔨 Kompiliere TypeScript..."
if npx tsc --noEmit; then
    echo -e "${GREEN}✓ TypeScript kompiliert ohne Fehler${NC}"
else
    echo -e "${RED}✗ TypeScript Kompilierungsfehler${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Alle Tests erfolgreich!${NC}"
echo ""
echo "Nächste Schritte:"
echo "1. Backend starten: cd backend && npm run dev"
echo "2. API Status prüfen: curl http://localhost:3001/api/ai/status"
echo "3. Produktvorschlag testen:"
echo '   curl -X POST http://localhost:3001/api/ai/suggest-products \\'
echo '     -H "Content-Type: application/json" \\'
echo '     -H "Authorization: Bearer YOUR_JWT_TOKEN" \\'
echo '     -d '"'"'{"query": "Katheter für Angiographie"}'"'"''
