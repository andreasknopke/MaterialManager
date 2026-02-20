# Railway Production Setup - Komplette Anleitung

## Schritt-für-Schritt Setup

### 1. Datenbank auf Railway vorbereiten

1. **Öffne Railway Dashboard**: https://railway.app
2. **Wähle dein Projekt** und gehe zum **MySQL Service**
3. **Öffne die "Data" Tab** (MySQL Console)

### 2. Vollständige Migration ausführen

**Kopiere den Inhalt von `railway-complete-migration.sql`** und führe ihn in der Railway MySQL Console aus:

```bash
# Datei: railway-complete-migration.sql
# Diese Migration enthält:
# - Migration 002: Units System (Departments/Abteilungen)
# - Migration 003: User Management System (Authentifizierung)
# - Migration 004: Department-Based Access Control
```

**Wichtig**: Das Script ist idempotent - es kann mehrfach ausgeführt werden ohne Fehler.

### 3. Root-User Passwort aktualisieren

Nach der Migration muss das Root-User Passwort korrekt gesetzt werden:

**Option A: Via API-Call (empfohlen)**

```bash
# Nach dem Backend-Deployment auf Railway:
curl -X POST https://DEINE-RAILWAY-URL.up.railway.app/api/admin/update-root-password
```

**Option B: Direkt in MySQL Console**

```sql
-- Generiere einen bcrypt Hash für "root" und führe aus:
UPDATE users 
SET password_hash = '$2b$10$yzun577cgxhiCzFmQIf2Ou/QVlqxIOd3bIqgrAoe8HIrVEVg0wXXe'
WHERE username = 'root' AND is_root = TRUE;
```

### 4. Backend Environment Variables überprüfen

Stelle sicher, dass folgende Environment Variables im Railway Backend-Service gesetzt sind:

```env
# Database (automatisch von Railway gesetzt)
DATABASE_URL=mysql://...
DB_HOST=...
DB_PORT=3306
DB_USER=root
DB_PASSWORD=...
DB_NAME=railway

# Application
PORT=3001
NODE_ENV=production

# JWT
JWT_SECRET=your_super_secret_production_jwt_key_CHANGE_THIS

# CORS (Frontend URL)
CORS_ORIGIN=https://deine-frontend-url.up.railway.app

# Optional: Email Service
# EMAIL_SERVICE=console|smtp|sendgrid
# SMTP_HOST=...
# SMTP_PORT=587
# SENDGRID_API_KEY=...
```

### 5. Frontend Environment Variables überprüfen

Railway Frontend-Service:

```env
# API URL (Backend URL)
REACT_APP_API_URL=https://deine-backend-url.up.railway.app
```

### 6. Deployment durchführen

1. **Push zu GitHub**:
```bash
git add .
git commit -m "feat: Complete Railway production setup"
git push origin main
```

2. **Railway deployed automatisch** beide Services (Backend + Frontend)

3. **Warte bis Deployments abgeschlossen sind** (ca. 2-5 Minuten)

### 7. Root-Passwort initialisieren

**Nach erfolgreichem Deployment**:

```bash
# Rufe die Admin-Route auf, um Root-Passwort zu setzen:
curl -X POST https://DEINE-BACKEND-URL.up.railway.app/api/admin/update-root-password

# Antwort sollte sein:
# {
# "success": true,
# "message": "Root user password updated. You can now login with username: root, password: root"
# }
```

### 8. Ersten Login durchführen

1. **Öffne die Frontend-URL**: https://DEINE-FRONTEND-URL.up.railway.app
2. **Login mit**:
   - Username: `root`
   - Password: `root`
3. **Du wirst aufgefordert, das Passwort zu ändern** (`must_change_password: true`)

### 9. Departments einrichten (Optional)

Die Migration erstellt automatisch 4 Standard-Departments:
- Radiologie (Blau)
- Angiologie (Grün)
- Gefäßchirurgie (Orange)
- Kardiologie (Rot)

Du kannst weitere Departments über die Admin-Oberfläche hinzufügen.

### 10. Weitere Admins anlegen

1. **Als Root eingeloggt**, gehe zu **Users** (Benutzerverwaltung)
2. **Erstelle neue Department Admins**:
   - Username, Email, Passwort eingeben
   - Role: `admin` auswählen
   - **Department zuweisen** (nur für Root sichtbar!)
   - Department Admin kann nur sein Department verwalten

## Sicherheitshinweise

### Produktions-Checkliste

- `JWT_SECRET` durch starken, zufälligen String ersetzen
- Root-Passwort nach erstem Login ändern
- `CORS_ORIGIN` auf exakte Frontend-URL setzen (nicht `*`)
- Datenbank-Backups in Railway aktivieren
- Email-Service konfigurieren für Passwort-Reset

### Sichere JWT_SECRET generieren

```bash
# Generiere einen sicheren JWT Secret:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Beispiel-Output:
# a4f8d9e2c1b3f5a6d8e9c1b3f5a6d8e9c1b3f5a6d8e9c1b3f5a6d8e9c1b3
```

## Troubleshooting

### Problem: Login funktioniert nicht

**Lösung**:
```bash
# 1. Prüfe ob Root-User existiert:
# In Railway MySQL Console:
SELECT id, username, email, is_root FROM users WHERE username = 'root';

# 2. Update Passwort manuell:
curl -X POST https://DEINE-BACKEND-URL/api/admin/update-root-password

# 3. Teste Login:
curl -X POST https://DEINE-BACKEND-URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"root","password":"root"}'
```

### Problem: Department-Filter funktionieren nicht

**Lösung**:
```sql
-- In Railway MySQL Console prüfen:
DESCRIBE users;
-- Sollte department_id Spalte zeigen

DESCRIBE cabinets;
-- Sollte unit_id Spalte zeigen

-- Falls Spalten fehlen, Migration erneut ausführen
```

### Problem: Views nicht vorhanden

**Lösung**:
```sql
-- Prüfe Views:
SHOW FULL TABLES WHERE Table_type = 'VIEW';

-- Sollte zeigen:
-- v_materials_overview
-- v_cabinets_overview
-- v_users_overview
-- v_expiring_materials
-- v_low_stock_materials
```

### Problem: Backend startet nicht

**Prüfe Logs in Railway**:
1. Gehe zu Backend-Service
2. Klicke auf "Deployments"
3. Klicke auf letztes Deployment
4. Prüfe "Build Logs" und "Deploy Logs"

**Häufige Fehler**:
- Fehlende Environment Variables
- Datenbank-Verbindung fehlgeschlagen
- TypeScript Compile-Fehler

## Migrations-Übersicht

| Migration | Beschreibung | Tabellen | Status |
|-----------|--------------|----------|--------|
| 002 | Units System | units, material_transfers, unit_id in materials/cabinets |  |
| 003 | User Management | users, user_sessions, login_attempts, user_audit_log |  |
| 004 | Department Access | department_id in users |  |

## Nächste Schritte nach Setup

1. Root-Login erfolgreich
2. Passwort geändert
3. Departments konfigurieren
4. Department Admins anlegen
5. Schränke zu Departments zuweisen
6. Materialien importieren
7. Email-Service aktivieren (optional)

## Support

Bei Problemen:
1. Prüfe Railway Logs (Backend + Frontend + Database)
2. Teste API-Endpoints mit curl
3. Prüfe Browser Console (F12) für Frontend-Fehler
4. Überprüfe Environment Variables

---

**Erstellt für Railway Production Deployment** 
