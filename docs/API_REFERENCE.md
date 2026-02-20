# API Reference

Basis-URL lokal:

```text
http://localhost:3001/api
```

## 1. Konventionen

- Content-Type: `application/json`
- Auth (wenn erforderlich): `Authorization: Bearer <JWT>`
- Optional für DB-Umschaltung: `X-DB-Token: <token>`
- Datumsfelder i. d. R. als ISO-String oder `YYYY-MM-DD` (je Endpoint)

Standard-Fehlercodes:

- `400` Bad Request
- `401` Nicht authentifiziert
- `403` Keine Berechtigung
- `404` Nicht gefunden
- `409` Konflikt (z. B. Duplicate)
- `500` Server-/Datenbankfehler

## 2. Authentifizierung

## Auth-Endpoints (`/api/auth`)

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| POST | `/auth/register` | Nein | Benutzer registrieren |
| POST | `/auth/login` | Nein | Login, liefert JWT + User |
| POST | `/auth/logout` | Ja | Aktuelle Session abmelden |
| GET | `/auth/me` | Ja | Aktuellen Benutzer lesen |
| POST | `/auth/change-password` | Ja | Passwort ändern |

### Beispiel Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "<username>",
  "password": "<password>"
}
```

Beispiel-Response:

```json
{
  "token": "<jwt>",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "fullName": "Administrator",
    "role": "admin",
    "isRoot": true,
    "departmentId": 1,
    "emailVerified": true,
    "mustChangePassword": false
  }
}
```

## 3. System-Endpoints

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/health` | Nein | Health-Check (`/health`, ohne `/api`) |
| POST | `/debug/gs1-log` | Nein | GS1-Debug-Payload loggen |

## 4. Benutzer und Berechtigungen

## User (`/api/users`)

Alle User-Routen sind authentifiziert. Einzelne Aktionen benötigen zusätzliche Rechte.

| Methode | Pfad | Rechte | Beschreibung |
|---|---|---|---|
| GET | `/users` | Admin | Alle Benutzer |
| GET | `/users/:id` | Auth | Benutzerdetails |
| POST | `/users` | Admin | Benutzer anlegen |
| PUT | `/users/:id` | Auth | Benutzer aktualisieren |
| DELETE | `/users/:id` | Admin | Benutzer deaktivieren/löschen |
| POST | `/users/:id/make-admin` | Root | Zu Admin machen |
| POST | `/users/:id/remove-admin` | Root | Admin-Rechte entfernen |
| GET | `/users/:id/audit-log` | Admin | User-Audit-Historie |

## 5. Stammdaten

## Units (`/api/units`)

| Methode | Pfad |
|---|---|
| GET | `/units` |
| GET | `/units/:id` |
| GET | `/units/:id/stats` |
| POST | `/units` |
| PUT | `/units/:id` |
| DELETE | `/units/:id` |
| GET | `/units/:id/transfers` |

## Kategorien (`/api/categories`)

| Methode | Pfad |
|---|---|
| GET | `/categories` |
| GET | `/categories/:id` |
| POST | `/categories` |
| PUT | `/categories/:id` |
| GET | `/categories/stats/inventory` |
| DELETE | `/categories/:id` |

## Firmen (`/api/companies`)

| Methode | Pfad |
|---|---|
| GET | `/companies` |
| GET | `/companies/:id` |
| POST | `/companies` |
| PUT | `/companies/:id` |
| DELETE | `/companies/:id` |

## Shapes (`/api/shapes`)

| Methode | Pfad |
|---|---|
| GET | `/shapes` |
| GET | `/shapes/all` |
| POST | `/shapes` |
| PUT | `/shapes/:id` |
| DELETE | `/shapes/:id` |

## Field Configs (`/api/field-configs`)

| Methode | Pfad |
|---|---|
| GET | `/field-configs` |
| GET | `/field-configs/:id` |
| POST | `/field-configs` |
| PUT | `/field-configs/:id` |
| DELETE | `/field-configs/:id` |

## Products (`/api/products`)

| Methode | Pfad |
|---|---|
| GET | `/products` |
| GET | `/products/:id` |
| GET | `/products/gtin/:gtin` |
| POST | `/products` |
| PUT | `/products/:id` |
| DELETE | `/products/:id` |

## 6. Schränke und Fächer

## Cabinets (`/api/cabinets`)

| Methode | Pfad |
|---|---|
| GET | `/cabinets` |
| GET | `/cabinets/:id` |
| GET | `/cabinets/:id/materials` |
| GET | `/cabinets/:id/infosheet` |
| POST | `/cabinets` |
| PUT | `/cabinets/:id` |
| DELETE | `/cabinets/:id` |
| GET | `/cabinets/:id/compartments` |
| POST | `/cabinets/:id/compartments` |
| PUT | `/cabinets/:cabinetId/compartments/:compartmentId` |
| DELETE | `/cabinets/:cabinetId/compartments/:compartmentId` |
| GET | `/cabinets/:cabinetId/compartments/:compartmentId/materials` |
| POST | `/cabinets/:id/clear` |

## 7. Materialien, Bestand und Reports

## Materials (`/api/materials`)

| Methode | Pfad |
|---|---|
| GET | `/materials/product-names` |
| GET | `/materials/by-name/:name` |
| GET | `/materials/by-gtin/:gtin` |
| POST | `/materials/search` |
| GET | `/materials` |
| GET | `/materials/:id` |
| GET | `/materials/:id/transactions` |
| POST | `/materials` |
| PUT | `/materials/:id` |
| POST | `/materials/:id/stock-in` |
| POST | `/materials/:id/stock-out` |
| DELETE | `/materials/:id` |
| POST | `/materials/:id/reactivate` |
| GET | `/materials/reports/counts` |
| GET | `/materials/reports/expiring` |
| GET | `/materials/reports/low-stock` |
| GET | `/materials/reports/inactive` |

### Beispiel Stock-Out

```http
POST /api/materials/123/stock-out
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "quantity": 2,
  "reference_number": "OP-2026-0001",
  "notes": "Patientenversorgung",
  "user_name": "Dr. Example"
}
```

## 8. Barcodes / GTIN

## Barcodes (`/api/barcodes`)

| Methode | Pfad |
|---|---|
| GET | `/barcodes/gtin/:gtin` |
| GET | `/barcodes/gtin/:gtin/materials` |
| GET | `/barcodes/search/:barcode` |
| GET | `/barcodes/material/:materialId` |
| POST | `/barcodes` |
| PUT | `/barcodes/:id` |
| DELETE | `/barcodes/:id` |
| POST | `/barcodes/material/:materialId/remove` |
| POST | `/barcodes/material/:materialId/add` |
| POST | `/barcodes/scan-out` |

## 9. Statistik, Reorder, Audit

## Statistics (`/api/statistics`)

| Methode | Pfad |
|---|---|
| GET | `/statistics/transactions` |
| GET | `/statistics/summary` |
| GET | `/statistics/daily` |
| GET | `/statistics/monthly` |
| GET | `/statistics/material-stats` |
| GET | `/statistics/user-activity` |

## Reorder (`/api/reorder`)

| Methode | Pfad |
|---|---|
| GET | `/reorder/stock-outs` |
| GET | `/reorder/stock-outs/:productId/transactions` |
| POST | `/reorder/mark-ordered` |
| GET | `/reorder/history` |
| PUT | `/reorder/history/:id` |
| DELETE | `/reorder/history/:id` |
| GET | `/reorder/is-ordered/:productId` |

## Audit Logs (`/api/audit-logs`)

Alle Endpunkte erfordern `authenticate` + `requireAdmin`.

| Methode | Pfad |
|---|---|
| GET | `/audit-logs` |
| GET | `/audit-logs/stats` |
| GET | `/audit-logs/actions` |
| GET | `/audit-logs/entity-types` |
| GET | `/audit-logs/entity/:type/:id` |

## 10. Interventionen

## Interventions (`/api/interventions`)

| Methode | Pfad |
|---|---|
| GET | `/interventions` |
| GET | `/interventions/unassigned/transactions` |
| POST | `/interventions/create-from-transactions` |
| GET | `/interventions/:id` |
| POST | `/interventions` |
| DELETE | `/interventions/:id` |
| POST | `/interventions/:id/add-items` |
| DELETE | `/interventions/:protocolId/items/:itemId` |
| PUT | `/interventions/transactions/:transactionId/lot` |
| PUT | `/interventions/:id` |

## 11. Administration

## Admin (`/api/admin`)

> Diese Endpunkte sind operativ kritisch und sollten nur in abgesicherten Admin-Kontexten genutzt werden.

| Methode | Pfad |
|---|---|
| POST | `/admin/reset-database` |
| POST | `/admin/run-migration` |
| POST | `/admin/run-user-migration` |
| POST | `/admin/run-department-migration` |
| POST | `/admin/update-root-password` |
| POST | `/admin/run-category-migration` |
| POST | `/admin/run-cabinet-department-migration` |
| POST | `/admin/fix-cabinet-departments` |
| GET | `/admin/debug-cabinets` |
| GET | `/admin/db-credentials` |
| POST | `/admin/run-endo-link-migration` |
| POST | `/admin/run-product-minstock-migration` |
| POST | `/admin/generate-db-token` |
| POST | `/admin/generate-db-token-custom` |
| POST | `/admin/token-info` |

## 12. KI-Endpoints

## AI (`/api/ai`)

| Methode | Pfad |
|---|---|
| GET | `/ai/status` |
| POST | `/ai/suggest-products` |
| POST | `/ai/analyze-barcode` |
| POST | `/ai/autocomplete` |
| POST | `/ai/lookup-material` |
| POST | `/ai/analyze-inventory-photo` |

## 13. Hinweise für Integrationen

- Für produktive API-Clients unbedingt automatische Token-Erneuerung/Relogin vorsehen.
- `401` sollte zentral behandelt werden (Session erneuern, User neu authentifizieren).
- Für importierende Systeme sind die Reports und Suchendpunkte (`/materials/search`, `/statistics/*`) die stabilsten Einstiegspunkte.
- Für schnelle E2E-Tests die Collections unter `docs/api` verwenden.
