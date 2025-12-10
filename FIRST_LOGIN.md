# User Management - Erste Schritte

## Installation (Railway)

### 1. Migration ausführen

Nach dem Deploy auf Railway:

1. Öffne die Anwendung
2. Navigiere zu **ohne Login** direkt zu: `https://your-app.railway.app/admin`
   - ⚠️ **ACHTUNG**: Admin-Route ist noch NICHT geschützt! Nach User-Installation muss diese geschützt werden.
3. Klicke auf **"User Management installieren"**
4. Warte auf Erfolgsmeldung: "User Management erfolgreich installiert! Login als 'root' / 'root'"

### 2. Erste Anmeldung

1. Öffne die Login-Seite: `/login`
2. Melde dich an mit:
   - **Username**: `root`
   - **Passwort**: `root`
3. Du wirst automatisch weitergeleitet
4. **WICHTIG**: Ändere sofort das Root-Passwort!
   - Klicke auf das Avatar-Icon oben rechts
   - Wähle "Passwort ändern"
   - Gib ein sicheres neues Passwort ein

## Funktionen

### Als Root-User

Du hast jetzt Zugriff auf:

- ✅ **Alle Material-Management-Funktionen**
- ✅ **Benutzerverwaltung** (Menü links → "Benutzerverwaltung")
  - Neue Benutzer erstellen
  - Benutzer bearbeiten/löschen
  - Admin-Rechte vergeben/entziehen
  - Benutzer-Status einsehen
- ✅ **Administration**
  - Datenbank leeren
  - Migrationen ausführen

### Neue Benutzer erstellen

1. Navigiere zu **Benutzerverwaltung**
2. Klicke auf **"Neuer Benutzer"**
3. Fülle das Formular aus:
   - Username (Pflicht)
   - E-Mail (Pflicht)
   - Passwort (Pflicht, mind. 6 Zeichen)
   - Vollständiger Name (Optional)
   - Rolle: User / Admin / Viewer
4. Klicke auf **"Erstellen"**

**Hinweise:**
- Admin-erstellte Benutzer sind bereits E-Mail-verifiziert
- Sie müssen beim ersten Login das Passwort ändern
- Admins können andere Benutzer verwalten (aber nicht Root)

### Selbst-Registrierung (über /register)

Benutzer können sich selbst registrieren:

1. Öffne `/register`
2. Fülle das Formular aus
3. Nach Registrierung wird eine E-Mail zur Verifizierung gesendet
4. **WICHTIG**: Im Entwicklungsmodus wird die E-Mail in der Backend-Konsole ausgegeben!

```bash
# In Railway Logs sehen Sie:
================================================
📧 E-MAIL-VERIFIZIERUNG
================================================
Von: noreply@materialmanager.local
An: user@example.com
Betreff: E-Mail-Adresse verifizieren

Verifizierungs-Link:
http://your-app.railway.app/verify-email/abc123...
================================================
```

5. Kopiere den Link und öffne ihn im Browser
6. Anschließend kann sich der Benutzer anmelden

## E-Mail-Konfiguration

### Entwicklung (Console-Modus - Standard)

In der `.env` Datei:

```env
EMAIL_SERVICE=console
EMAIL_FROM=noreply@materialmanager.local
FRONTEND_URL=https://your-app.railway.app
```

E-Mails werden in den Backend-Logs ausgegeben.

### Produktion (SMTP / SendGrid)

Für echte E-Mails konfiguriere in Railway Environment Variables:

**SMTP (z.B. Gmail):**
```env
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
FRONTEND_URL=https://your-app.railway.app
```

**SendGrid:**
```env
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
FRONTEND_URL=https://your-app.railway.app
```

## Rollen-System

### Root
- **Ist**: Der Super-Administrator
- **Kann**:
  - Alle Admin-Funktionen
  - Admin-Rechte vergeben/entziehen
  - Kann nicht gelöscht werden
  - Kann nicht degradiert werden

### Admin
- **Kann**:
  - Benutzer erstellen/bearbeiten/löschen
  - Alle Material-Management-Funktionen
  - Administration-Bereich nutzen
- **Kann nicht**:
  - Root-User bearbeiten
  - Anderen Admins Admin-Rechte entziehen (nur Root kann das)

### User
- **Kann**:
  - Alle Material-Management-Funktionen
  - Eigenes Profil bearbeiten
  - Eigenes Passwort ändern

### Viewer
- **Kann**:
  - Nur Daten ansehen
  - Keine Änderungen vornehmen
  - Eigenes Passwort ändern

## Sicherheits-Features

### Automatischer Logout
- JWT-Token läuft nach 24 Stunden ab
- Bei 401 Unauthorized wird automatisch zur Login-Seite weitergeleitet

### Rate-Limiting
- Maximal 5 fehlgeschlagene Login-Versuche
- 15 Minuten Sperrzeit nach 5 Versuchen

### Passwort-Sicherheit
- Bcrypt-Hashing mit 10 Runden
- Mindestens 6 Zeichen (sollte im Frontend erhöht werden)
- Erzwungener Passwortwechsel bei Erstanmeldung

### Session-Management
- JWT-Sessions werden in Datenbank getrackt
- Logout löscht Session aus Datenbank

### Audit-Logging
Alle sicherheitsrelevanten Aktionen werden protokolliert in `user_audit_log`:
- Login/Logout
- Passwortänderungen
- Benutzer-CRUD
- Rollen-Änderungen

## Troubleshooting

### "Cannot read properties of undefined (reading 'user')"
- AuthContext wurde nicht korrekt geladen
- Stelle sicher, dass App.tsx den AuthProvider enthält

### "401 Unauthorized"
- Token ist abgelaufen oder ungültig
- Melde dich erneut an

### "E-Mail bereits vergeben"
- Ein Benutzer mit dieser E-Mail existiert bereits
- Nutze eine andere E-Mail oder lösche den alten Benutzer

### "Zu viele Login-Versuche"
- Rate-Limit erreicht
- Warte 15 Minuten oder lösche Einträge in `login_attempts` Tabelle

### Backend-Verbindungsfehler
- Prüfe ob Backend läuft
- Prüfe Railway Logs auf Fehler
- Stelle sicher, dass JWT_SECRET in Railway gesetzt ist

## Nächste Schritte

1. ✅ Root-Passwort ändern
2. ✅ Ersten Admin-Benutzer erstellen
3. ✅ E-Mail-Service konfigurieren (SMTP/SendGrid)
4. ⚠️ Admin-Route schützen (Backend auth.routes einbauen)
5. ⚠️ Passwort-Mindestlänge erhöhen (z.B. 8 Zeichen)
6. ⚠️ Passwort-Komplexität validieren (Groß-/Kleinbuchstaben, Zahlen)
7. ⚠️ JWT_SECRET in Railway auf sicheren Wert setzen

## Support

Bei Problemen:
- Prüfe Railway Logs
- Prüfe Browser Developer Console
- Prüfe USER_MANAGEMENT.md für Details
