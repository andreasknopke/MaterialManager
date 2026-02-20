# Developer Guide

## 1. Systemüberblick

MaterialManager ist ein Materialmanagementsystem für klinische Bereiche (u. a. Angiographie) mit Fokus auf:

- Material- und Bestandsverwaltung
- Barcode-/GTIN-Workflows
- Schrank- und Fachverwaltung
- Interventionsprotokolle
- Reorder-/Stock-out-Management
- Benutzer-, Rollen- und Audit-Logik

## 2. Architektur

## Backend

- Runtime: Node.js + Express
- Sprache: TypeScript
- DB: MySQL
- Auth: JWT (`Authorization: Bearer <token>`)
- Multi-DB-Support: optional über `X-DB-Token`

## Frontend

- React + TypeScript
- Kommuniziert ausschließlich über REST unter `/api/*`

## Routing-Entry

Alle API-Router werden in `backend/src/server.ts` gemountet.

Wichtige Basispfade:

- `/api/auth`
- `/api/users`
- `/api/materials`
- `/api/barcodes`
- `/api/interventions`
- `/api/reorder`
- `/api/admin`
- `/api/ai`

Zusätzlich:

- `GET /health`
- `POST /api/debug/gs1-log`

## 3. Authentifizierung und Rollen

## JWT

Nach Login liefert `POST /api/auth/login` ein JWT.

Token verwenden:

```http
Authorization: Bearer <token>
```

## Rollenmodell

- `viewer` – lesend, eingeschränkte Aktionen
- `user` – operative Aktionen (Bestand, Materialfluss)
- `admin` – Verwaltungsfunktionen
- `root` (Flag `isRoot`) – volle Systemrechte für sensible Admin-Endpunkte

## Middleware

- `authenticate` validiert JWT + Benutzerstatus
- `requireAdmin` erzwingt Rolle `admin`
- `requireRoot` erzwingt `isRoot = true`

## 4. DB-Token (mandanten-/datenbankbezogen)

Optionaler Header:

```http
X-DB-Token: <token>
```

Wenn gesetzt und gültig, wird eine alternative DB-Verbindung genutzt. Ohne Token arbeitet das System mit Standard-DB-Credentials aus ENV.

## 5. Lokale Entwicklung

## Voraussetzungen

- Node.js 18+
- npm
- MySQL 8+

## Backend

```bash
cd backend
npm install
npm run dev
```

## Frontend

```bash
cd frontend
npm install
npm start
```

## Datenbank

Schema und Migrationen liegen unter:

- `database/schema.sql`
- `database/migrations/*.sql`

## 6. Konfiguration

Relevante Backend-Variablen:

- `PORT`
- `NODE_ENV`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`
- `CORS_ORIGIN`

## 7. Domänen-Workflows

## 7.1 Login und Session

1. User loggt sich über `/api/auth/login` ein
2. API erstellt JWT und Session-Eintrag
3. Folgeaufrufe authentifiziert über Bearer-Token
4. `/api/auth/logout` invalidiert Session

## 7.2 Material-Lifecycle

1. Stammdaten aus GTIN oder Name vorbefüllen
2. Material anlegen (`POST /api/materials`)
3. Bestand via `stock-in` / `stock-out` verändern
4. Bewegungen über `/:id/transactions` nachverfolgen
5. Material deaktivieren oder reaktivieren

## 7.3 Barcode-Flow

1. GTIN auflösen (`/api/barcodes/gtin/:gtin`)
2. Material-/Barcode-Zuordnung verwalten
3. Scan-Out direkt aus Barcode-Flow buchen

## 7.4 Interventionen

1. Unzugeordnete Entnahmen abrufen
2. Protokoll erzeugen (auch aus Transaktionen)
3. Items nachpflegen / entfernen
4. Materialverbrauch patientenbezogen auswerten

## 7.5 Reorder

1. Stock-Outs und Unterbestände prüfen
2. Bestellungen markieren (`mark-ordered`)
3. Historie auswerten und pflegen

## 8. Logging und Auditing

- Request-Logging in Express-Middleware
- Fachliche Audit-Logs (User/Material/Intervention/Transactions)
- Separate Audit-Endpoints unter `/api/audit-logs`

## 9. Erweiterungspunkte

- Neue Ressource: neuer Router unter `backend/src/routes`
- Router in `server.ts` mounten
- Falls geschützt: `router.use(authenticate)` ergänzen
- Bei sensiblen Aktionen: Audit-Log ergänzen
- DB-Änderungen über neue SQL-Migration in `database/migrations`

## 10. API-Verwendung

Die vollständige Endpunktliste mit Parametern findest du in [API_REFERENCE.md](./API_REFERENCE.md).

Für schnelles Testen:

- Postman: `docs/api/MaterialManager.postman_collection.json`
- Insomnia: `docs/api/MaterialManager.insomnia.json`

## 11. Secret-Hygiene (Pflicht)

- Keine echten Zugangsdaten, Tokens oder Passwörter in Doku, Collections oder Beispiel-Payloads committen.
- Für Beispiele ausschließlich Platzhalter oder Variablen verwenden, z. B. `<username>`, `<password>`, `{{username}}`, `{{password}}`.
- Produktive Credentials ausschließlich im Secret-Store/Environment halten (nie im Repository).
- Vor jedem Push kurz prüfen, dass keine bekannten Secret-Muster enthalten sind (z. B. in `docs/api/*`, `*.md`).
