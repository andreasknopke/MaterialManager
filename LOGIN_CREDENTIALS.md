# Login Credentials - Material Manager

## Production (Railway)
**URL:** https://robust-vision-production.up.railway.app

### Root Admin
- **Username:** `root`
- **Passwort:** `Goethestrasse28!`
- **Berechtigung:** Vollzugriff auf alle Departments

### Department Admin (Radiologie)
- **Username:** `Andreas Knopke`
- **Passwort:** `Admin123!`
- **Department:** Radiologie (ID: 1)
- **Berechtigung:** Zugriff nur auf Radiologie-Department

---

## ⚠️ Wichtig nach Code-Deployment

Nach jedem Backend-Deployment, das die Authentication ändert, **muss sich der User neu einloggen**:

1. Im Frontend: **Abmelden** (Logout)
2. Browser-Cache leeren (Ctrl+Shift+R oder Cmd+Shift+R)
3. Neu einloggen mit den aktuellen Credentials

### Warum?
- Alte JWT-Tokens im Browser-LocalStorage sind nach Code-Updates ungültig
- Die Token-Struktur hat sich geändert (departmentId hinzugefügt)
- Sessions müssen neu erstellt werden

---

## Fehlerbehebung

### 401 Unauthorized Fehler
**Symptom:** Alle API-Calls liefern 401 zurück
**Lösung:**
1. Logout im Frontend
2. LocalStorage prüfen: `localStorage.clear()` in Browser-Console
3. Neu einloggen

### Department wird nicht angezeigt
**Symptom:** User sieht "-" statt Department-Name
**Ursache:** View `v_users_overview` war nicht aktualisiert
**Status:** ✅ Behoben am 10.12.2025

### Kann keine Schränke anlegen (500 Error)
**Ursache:** `getDepartmentFilter` verwendete falschen Table-Alias
**Status:** ✅ Behoben am 10.12.2025

---

## Nächste Schritte für den User

1. **Abmelden** im Frontend (https://robust-vision-production.up.railway.app)
2. **Browser neu laden** (Ctrl+Shift+R)
3. **Neu einloggen** mit:
   - Username: `Andreas Knopke`
   - Passwort: `Admin123!`
4. **Schrank anlegen** testen
5. **Material erstellen** testen

Die Debug-Logs im Backend zeigen jetzt detailliert, was bei jedem Request passiert.
