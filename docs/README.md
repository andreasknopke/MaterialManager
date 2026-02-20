# Entwicklerdokumentation – MaterialManager

Diese Dokumentation richtet sich an externe Entwickler, die das System lokal starten, erweitern und die API integrieren möchten.

## Inhalte

- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) – Architektur, Setup, Workflows, Rollen, Erweiterungspunkte
- [API_REFERENCE.md](./API_REFERENCE.md) – vollständige API-Referenz inkl. Authentifizierung, Headern und Endpunkten
- [api/MaterialManager.postman_collection.json](./api/MaterialManager.postman_collection.json) – Postman Collection
- [api/MaterialManager.postman_environment.json](./api/MaterialManager.postman_environment.json) – Postman Environment
- [api/MaterialManager.insomnia.json](./api/MaterialManager.insomnia.json) – Insomnia Export

## Schnellstart für API-Tests

1. Backend starten (Standard: `http://localhost:3001`)
2. In Postman oder Insomnia Environment importieren
3. `POST /api/auth/login` ausführen
4. JWT-Token als `Bearer` verwenden
5. Optional `X-DB-Token` setzen (mandanten-/datenbank-spezifisch)

## Hinweise

- Die Referenz in [API_REFERENCE.md](./API_REFERENCE.md) ist auf den aktuellen Routen in `backend/src/server.ts` und `backend/src/routes/*.ts` aufgebaut.
- Alle Endpunkte unter `/api/*` erwarten JSON (`Content-Type: application/json`), sofern nicht anders beschrieben.
