# 🚂 Railway Deployment - Quick Start

## Automatisches Setup (empfohlen)

### 1. Migration in Railway MySQL Console ausführen

```sql
-- Kopiere den kompletten Inhalt von railway-complete-migration.sql
-- und füge ihn in die Railway MySQL Console ein
```

### 2. Backend deployen lassen

Railway deployed automatisch bei Git Push. Warte bis Deployment abgeschlossen ist.

### 3. Setup-Script ausführen

```bash
# Setze deine Backend-URL
export RAILWAY_BACKEND_URL=https://deine-backend-url.up.railway.app

# Führe Setup aus
./setup-railway-production.sh
```

Das Script:
- ✅ Prüft Backend-Erreichbarkeit
- ✅ Setzt Root-User Passwort
- ✅ Testet Login
- ✅ Prüft Departments

### 4. Login durchführen

Öffne: `https://deine-frontend-url.up.railway.app`

**Credentials:**
- Username: `root`
- Password: `root`

⚠️ **Du wirst beim ersten Login aufgefordert, das Passwort zu ändern!**

---

## Manuelles Setup

Siehe: [RAILWAY_PRODUCTION_SETUP.md](./RAILWAY_PRODUCTION_SETUP.md)

---

## Environment Variables

### Backend Service

**Automatisch von Railway:**
```env
DATABASE_URL=mysql://...
DB_HOST=...
DB_PORT=3306
DB_USER=root
DB_PASSWORD=...
DB_NAME=railway
```

**Manuell setzen:**
```env
PORT=3001
NODE_ENV=production
JWT_SECRET=<generiere-mit-crypto.randomBytes>
CORS_ORIGIN=https://deine-frontend-url.up.railway.app
```

### Frontend Service

```env
REACT_APP_API_URL=https://deine-backend-url.up.railway.app
```

---

## Migrations-Dateien

| Datei | Verwendung |
|-------|------------|
| `railway-complete-migration.sql` | **Produktions-Setup** - Alle Migrationen kombiniert |
| `railway-migration-manual.sql` | Legacy - nur Units System |
| `database/migrations/*.sql` | Development - einzelne Migrationen |

---

## Troubleshooting

### Backend startet nicht

```bash
# In Railway: Backend Service → Deployments → View Logs
```

Häufige Probleme:
- `JWT_SECRET` fehlt
- Datenbank-Verbindung fehlgeschlagen
- CORS-Fehler

### Login funktioniert nicht

```bash
# Root-Passwort manuell setzen:
curl -X POST https://DEINE-URL/api/admin/update-root-password
```

### Department-Filter funktionieren nicht

```sql
-- In Railway MySQL Console:
DESCRIBE users;  -- Sollte department_id zeigen
DESCRIBE cabinets;  -- Sollte unit_id zeigen
```

Falls Spalten fehlen: Migration erneut ausführen

---

## Support

📚 **Vollständige Dokumentation:** [RAILWAY_PRODUCTION_SETUP.md](./RAILWAY_PRODUCTION_SETUP.md)

🔧 **Setup-Script:** `./setup-railway-production.sh`

🗃️ **Migration:** `railway-complete-migration.sql`
