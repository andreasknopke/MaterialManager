# Railway Production Deployment - Checkliste

## Pre-Deployment (Lokal)

- [x] Alle Migrationen entwickelt (002, 003, 004)
- [x] Department-Filter in Material/Cabinet-Routen
- [x] Admin-Route für Root-Passwort Update
- [x] Complete Migration Script erstellt
- [x] Setup-Script erstellt
- [x] Dokumentation geschrieben
- [x] Code committed und gepusht

## Railway Deployment Steps

### Schritt 1: Railway MySQL Console

```
Railway Dashboard → MySQL Service → Data Tab → Query
```

**Aktion:**
1. Öffne `railway-complete-migration.sql`
2. Kopiere **gesamten Inhalt**
3. Füge in Railway MySQL Console ein
4. Klicke "Run"
5. Warte auf Success-Meldungen

**Erwartete Ausgabe:**
```
 Migration 002: Units System completed!
 Migration 003: User Management System completed!
 Migration 004: Department-Based Access Control completed!
 ALL MIGRATIONS COMPLETED SUCCESSFULLY!
```

**Dauer:** ~30 Sekunden

---

### Schritt 2: Backend Environment Variables

```
Railway Dashboard → Backend Service → Variables Tab
```

**Erforderliche Variables:**

| Variable | Wert | Quelle |
|----------|------|--------|
| `DATABASE_URL` | `mysql://...` |  Automatisch |
| `DB_HOST` | Railway Host |  Automatisch |
| `DB_PORT` | `3306` |  Automatisch |
| `DB_USER` | `root` |  Automatisch |
| `DB_PASSWORD` | Railway Password |  Automatisch |
| `DB_NAME` | `railway` |  Automatisch |
| `PORT` | `3001` |  Manuell setzen |
| `NODE_ENV` | `production` |  Manuell setzen |
| `JWT_SECRET` | `<random-64-byte-hex>` |  **WICHTIG!** |
| `CORS_ORIGIN` | `https://frontend-url...` |  Manuell setzen |

**JWT_SECRET generieren:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### Schritt 3: Frontend Environment Variables

```
Railway Dashboard → Frontend Service → Variables Tab
```

| Variable | Wert |
|----------|------|
| `REACT_APP_API_URL` | `https://backend-url.up.railway.app` |

---

### Schritt 4: Deployment triggern

**Option A: Automatisch (empfohlen)**
```bash
git push origin main
```
Railway deployed automatisch bei jedem Push.

**Option B: Manuell**
```
Railway Dashboard → Service → Deployments → Redeploy
```

**Warte auf:**
- Backend Build erfolgreich
- Backend Deploy erfolgreich  
- Frontend Build erfolgreich
- Frontend Deploy erfolgreich

**Dauer:** 3-5 Minuten

---

### Schritt 5: Root-Passwort initialisieren

**Methode 1: Setup-Script (lokal)**
```bash
export RAILWAY_BACKEND_URL=https://materialmanager-backend-production.up.railway.app
./setup-railway-production.sh
```

**Methode 2: Manueller API-Call**
```bash
curl -X POST https://DEINE-BACKEND-URL/api/admin/update-root-password
```

**Erwartete Antwort:**
```json
{
  "success": true,
  "message": "Root user password updated. You can now login with username: root, password: root"
}
```

---

### Schritt 6: Ersten Login durchführen

**Frontend öffnen:**
```
https://DEINE-FRONTEND-URL.up.railway.app
```

**Login:**
- Username: `root`
- Password: `root`

**Erwartung:**
- Login erfolgreich
- "Passwort muss geändert werden" Dialog erscheint
- Neues Passwort setzen
- Re-Login mit neuem Passwort

---

### Schritt 7: Verifizierung

**Prüfe Departments:**
```bash
# Mit neuem Token nach Login:
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://DEINE-BACKEND-URL/api/units
```

**Erwartete Antwort:**
```json
[
  {"id": 1, "name": "Radiologie", "color": "#2196F3"},
  {"id": 2, "name": "Angiologie", "color": "#4CAF50"},
  {"id": 3, "name": "Gefäßchirurgie", "color": "#FF9800"},
  {"id": 4, "name": "Kardiologie", "color": "#F44336"}
]
```

**Prüfe Department-Filter:**
1. Erstelle Department Admin User
2. Weise Department zu
3. Logout als Root
4. Login als Department Admin
5. Prüfe: Sieht nur sein Department

---

## Post-Deployment Checks

### Backend Health
```bash
curl https://DEINE-BACKEND-URL/health
# → {"status":"OK","timestamp":"..."}
```

### Frontend erreichbar
```bash
curl -I https://DEINE-FRONTEND-URL
# → HTTP/2 200
```

### Database Tables
```sql
-- In Railway MySQL Console:
SHOW TABLES;
```

**Erwartete Tabellen:**
- barcodes
- cabinets
- categories
- companies
- field_configurations
- login_attempts
- material_custom_fields
- material_transactions
- material_transfers
- materials
- units
- user_audit_log
- user_sessions
- users

### Database Views
```sql
SHOW FULL TABLES WHERE Table_type = 'VIEW';
```

**Erwartete Views:**
- v_cabinets_overview
- v_expiring_materials
- v_low_stock_materials
- v_materials_overview
- v_users_overview

---

## Success Criteria

- Backend erreichbar (`/health` → 200)
- Frontend erreichbar (Login-Seite lädt)
- Root-Login funktioniert (`root`/`root`)
- Passwort-Änderung erzwungen
- 4 Departments vorhanden
- User kann angelegt werden
- Department Admin sieht nur sein Department
- Material/Cabinet CRUD funktioniert
- Department-Filter aktiv

---

## Troubleshooting

### Backend startet nicht
1. Prüfe Logs: Railway → Backend → Deployments → View Logs
2. Prüfe Environment Variables (besonders `JWT_SECRET`)
3. Prüfe Database Connection

### Frontend kann Backend nicht erreichen
1. Prüfe `REACT_APP_API_URL` in Frontend Variables
2. Prüfe `CORS_ORIGIN` in Backend Variables
3. Browser DevTools → Network Tab

### Login failed 500
1. Root-Passwort neu setzen: `POST /api/admin/update-root-password`
2. Prüfe Backend Logs für DB-Fehler
3. Prüfe ob Migration erfolgreich war

### Department-Filter nicht aktiv
1. Prüfe: `DESCRIBE users;` → `department_id` Spalte vorhanden?
2. Prüfe: `DESCRIBE cabinets;` → `unit_id` Spalte vorhanden?
3. Falls nein: Migration erneut ausführen

---

## Dokumentation

- **Quick Start:** [RAILWAY_QUICKSTART_PROD.md](./RAILWAY_QUICKSTART_PROD.md)
- **Vollständige Anleitung:** [RAILWAY_PRODUCTION_SETUP.md](./RAILWAY_PRODUCTION_SETUP.md)
- **Migration Script:** [railway-complete-migration.sql](./railway-complete-migration.sql)
- **Setup Script:** [setup-railway-production.sh](./setup-railway-production.sh)

---

**Deployment-Status:**  Production Ready!
