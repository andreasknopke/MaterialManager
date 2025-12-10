# User Management System

## Übersicht

Das Material Manager System verfügt über ein vollständiges User-Management-System mit E-Mail-Verifizierung, Rollen-basierter Zugriffskontrolle und Audit-Logging.

## Funktionen

### 1. Benutzer-Rollen

- **Root**: Der Super-Administrator mit allen Rechten
- **Admin**: Kann Benutzer verwalten und Admin-Funktionen nutzen
- **User**: Normaler Benutzer mit Standardrechten
- **Viewer**: Nur-Lese-Zugriff

### 2. Authentifizierung

- JWT-basierte Authentifizierung
- Session-Management
- Rate-Limiting (5 Login-Versuche pro 15 Minuten)
- Automatisches Logout bei Inaktivität

### 3. E-Mail-Verifizierung

- Neue Benutzer müssen ihre E-Mail-Adresse verifizieren
- Verifizierungs-Token läuft nach 24 Stunden ab
- Admin-erstellte Benutzer sind bereits verifiziert

### 4. Passwort-Verwaltung

- Bcrypt-Hashing mit Salt
- Passwort-Änderung für angemeldete Benutzer
- Passwort-Reset per E-Mail (Token läuft nach 1 Stunde ab)
- Erzwungener Passwortwechsel bei Erstanmeldung

### 5. Audit-Logging

Alle sicherheitsrelevanten Aktionen werden protokolliert:
- Login/Logout
- Passwortänderungen
- Benutzer-CRUD-Operationen
- Rollen-Änderungen

## Installation und Setup

### 1. Migration ausführen

Die Datenbank-Migration erstellt alle benötigten Tabellen und den Root-Benutzer:

```bash
mysql -u root -p material_manager < database/migrations/003_add_user_management.sql
```

Oder über die Admin-UI: Admin-Bereich → "Migration ausführen"-Button

### 2. Umgebungsvariablen konfigurieren

Bearbeite `backend/.env`:

```env
# JWT Secret (WICHTIG: In Produktion ändern!)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# E-Mail-Service (Optionen: console, smtp, sendgrid)
EMAIL_SERVICE=console
EMAIL_FROM=noreply@materialmanager.local
FRONTEND_URL=http://localhost:3000

# Für SMTP (Gmail-Beispiel):
# EMAIL_SERVICE=smtp
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password

# Für SendGrid:
# EMAIL_SERVICE=sendgrid
# SENDGRID_API_KEY=your-sendgrid-api-key
```

### 3. Abhängigkeiten installieren

Die benötigten Pakete sind bereits in `package.json`:

```bash
cd backend
npm install
```

## Erstanmeldung

### Root-Benutzer

Nach der Migration existiert ein Root-Benutzer:

- **Username**: `root`
- **Passwort**: `root`
- **Hinweis**: Sie werden beim ersten Login aufgefordert, das Passwort zu ändern!

### Erste Schritte

1. Melde dich als Root an
2. Ändere das Root-Passwort
3. Erstelle weitere Admin-Benutzer
4. Konfiguriere E-Mail-Einstellungen für Verifizierung

## API-Endpunkte

### Authentifizierung

```
POST   /api/auth/register              Neuen Benutzer registrieren
POST   /api/auth/login                 Anmelden
POST   /api/auth/logout                Abmelden
GET    /api/auth/verify-email/:token   E-Mail verifizieren
POST   /api/auth/change-password       Passwort ändern
POST   /api/auth/request-password-reset  Passwort-Reset anfordern
POST   /api/auth/reset-password        Passwort zurücksetzen
GET    /api/auth/me                    Aktuellen Benutzer abrufen
```

### Benutzerverwaltung

```
GET    /api/users                      Alle Benutzer (Admin)
GET    /api/users/:id                  Einzelner Benutzer
POST   /api/users                      Benutzer erstellen (Admin)
PUT    /api/users/:id                  Benutzer aktualisieren
DELETE /api/users/:id                  Benutzer löschen (Admin)
POST   /api/users/:id/make-admin       Admin-Rechte vergeben (Root)
POST   /api/users/:id/remove-admin     Admin-Rechte entziehen (Root)
GET    /api/users/:id/audit-log        Audit-Log abrufen (Admin)
```

## Sicherheitsmerkmale

### 1. Passwort-Sicherheit

- Bcrypt mit 10 Runden
- Keine Passwörter in Klartext
- Mindestanforderungen sollten im Frontend implementiert werden

### 2. Session-Management

- JWT-Token mit 24 Stunden Gültigkeit
- Sessions werden in der Datenbank gespeichert
- Automatische Bereinigung abgelaufener Sessions

### 3. Rate-Limiting

- Maximal 5 fehlgeschlagene Login-Versuche
- 15 Minuten Sperrzeit nach 5 Versuchen
- Schutz vor Brute-Force-Angriffen

### 4. Schutz des Root-Benutzers

- Root kann nicht gelöscht werden
- Root-Rolle kann nicht entfernt werden
- Nur Root kann Root-Eigenschaften ändern

## E-Mail-Konfiguration

### Console-Modus (Entwicklung)

```env
EMAIL_SERVICE=console
```

Verifizierungs-Links werden in der Konsole ausgegeben.

### SMTP (Gmail-Beispiel)

1. Aktiviere "Weniger sichere Apps" oder erstelle ein App-Passwort
2. Konfiguriere `.env`:

```env
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
```

### SendGrid

1. Erstelle einen API-Key bei SendGrid
2. Konfiguriere `.env`:

```env
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```

## Datenbank-Schema

### Tabellen

- **users**: Benutzer mit Credentials
- **user_sessions**: Aktive Sessions
- **login_attempts**: Failed-Login-Tracking
- **user_audit_log**: Sicherheits-Audit-Trail

### Views

- **v_users_overview**: Übersicht aller Benutzer (ohne Passwörter)
- **v_active_sessions**: Derzeit aktive Sessions

## Fehlerbehandlung

### Häufige Fehler

**"E-Mail bereits vergeben"**
- Ein Benutzer mit dieser E-Mail existiert bereits
- Prüfe die Datenbank oder nutze Passwort-Reset

**"Ungültige Credentials"**
- Username oder Passwort falsch
- Prüfe Groß-/Kleinschreibung

**"Zu viele Login-Versuche"**
- Rate-Limit erreicht
- Warte 15 Minuten oder lösche Einträge in `login_attempts`

**"E-Mail nicht verifiziert"**
- Benutzer muss E-Mail-Adresse verifizieren
- Prüfe Spam-Ordner oder sende neuen Link

## Wartung

### Sessions bereinigen

```sql
DELETE FROM user_sessions 
WHERE expires_at < NOW();
```

### Login-Attempts zurücksetzen

```sql
DELETE FROM login_attempts 
WHERE attempt_time < DATE_SUB(NOW(), INTERVAL 15 MINUTE);
```

### Audit-Log begrenzen

```sql
DELETE FROM user_audit_log 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

## Frontend-Integration (TODO)

Die folgenden Frontend-Komponenten müssen noch erstellt werden:

1. **Login-Seite** (`src/pages/Login.tsx`)
2. **Registrierungs-Seite** (`src/pages/Register.tsx`)
3. **User-Management-Seite** (`src/pages/Users.tsx`)
4. **Auth-Context** (`src/contexts/AuthContext.tsx`)
5. **Protected-Route-Component** (`src/components/ProtectedRoute.tsx`)
6. **Passwort-Ändern-Dialog**
7. **Passwort-Reset-Seite**

## Sicherheitshinweise für Produktion

1. **JWT_SECRET**: Generiere einen starken, zufälligen Secret-Key
2. **HTTPS**: Nutze immer HTTPS in Produktion
3. **E-Mail**: Konfiguriere einen echten E-Mail-Service
4. **Root-Passwort**: Ändere sofort nach Installation
5. **Rate-Limiting**: Erwäge zusätzliches Rate-Limiting auf Proxy-Ebene
6. **Session-Timeout**: Passe Token-Gültigkeitsdauer an deine Anforderungen an
7. **CORS**: Beschränke CORS_ORIGIN auf deine Domain

## Support und Troubleshooting

### Datenbank-Verbindungsprobleme

Prüfe `backend/src/config/database.ts` und `.env`-Variablen.

### JWT-Token-Fehler

- Prüfe ob JWT_SECRET in `.env` gesetzt ist
- Lösche alte Sessions: `DELETE FROM user_sessions;`

### E-Mail-Versand schlägt fehl

- Prüfe E-Mail-Konfiguration in `.env`
- Im Console-Modus: Prüfe Backend-Logs für Verifizierungs-Links
- Im SMTP-Modus: Prüfe Firewall und Credentials
