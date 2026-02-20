# Railway Schnellstart

## 1. Code zu GitHub pushen

```bash
git add .
git commit -m "Material Manager - Railway ready"
git push
```

## 2. Railway Dashboard

Gehen Sie zu [railway.app](https://railway.app) → **New Project**

## 3. Services erstellen (in dieser Reihenfolge):

### A) MySQL Datenbank
- **+ New** → **Database** → **MySQL**
- Fertig! 

### B) Backend
- **+ New** → **GitHub Repo** → Wählen Sie `MaterialManager`
- **Settings** → **Root Directory**: `backend`
- **Variables** Tab → Fügen Sie hinzu:
  ```
  NODE_ENV=production
  JWT_SECRET=ihr_geheimer_schluessel_hier
  CORS_ORIGIN=*
  ```
- **Connect** MySQL Datenbank:
  - Klicken Sie auf Backend Service
  - **+ Variable** → **Add Reference** → Wählen Sie MySQL
  - Folgende Variablen verbinden:
    - `MYSQLHOST` → `DB_HOST`
    - `MYSQLPORT` → `DB_PORT`
    - `MYSQLUSER` → `DB_USER`
    - `MYSQLPASSWORD` → `DB_PASSWORD`
    - `MYSQLDATABASE` → `DB_NAME`
- **Settings** → **Generate Domain** → Notieren Sie die URL!

### C) Frontend
- **+ New** → **GitHub Repo** → Wählen Sie `MaterialManager`
- **Settings** → **Root Directory**: `frontend`
- **Variables** Tab → Fügen Sie hinzu:
  ```
  REACT_APP_API_URL=https://IHR-BACKEND-URL.up.railway.app/api
  ```
  (Ersetzen Sie mit Ihrer Backend-URL von Schritt B)
- **Settings** → **Generate Domain**

## 4. Datenbank initialisieren

### WICHTIG: Dies ist der wichtigste Schritt!

**Methode 1 - MySQL Client (EMPFOHLEN):**

1. Gehen Sie zu Ihrem **MySQL Service** in Railway
2. Klicken Sie auf den **"Data"** Tab oder **"Connect"**
3. Kopieren Sie die Verbindungsdaten:
   - Host (z.B. `containers-us-west-xxx.railway.app`)
   - Port (z.B. `6789`)
   - Username (z.B. `root`)
   - Password (z.B. `xxxxxxxxxx`)
   - Database (z.B. `railway`)

4. Verbinden Sie sich mit einem MySQL Client:

**Windows/Mac/Linux - Mit MySQL Workbench:**
   - Öffnen Sie MySQL Workbench
   - Neue Verbindung erstellen mit den Daten von oben
   - SQL Tab öffnen
   - Kopieren Sie den Inhalt von `database/schema.sql`
   - Führen Sie das Script aus

**ODER mit Kommandozeile:**
```bash
# Verbinden
mysql -h [IHR_HOST] -P [IHR_PORT] -u root -p

# Passwort eingeben wenn gefragt
# Dann Schema laden:
USE railway;
# Kopieren Sie nun den Inhalt von database/schema.sql und fügen Sie ihn ein
```

**Methode 2 - Railway CLI:**
```bash
# Railway CLI installieren
npm i -g @railway/cli

# Login
railway login

# Mit Ihrem Projekt verbinden
railway link

# Zur MySQL Datenbank wechseln
railway service

# Schema importieren (stelle sicher, dass Sie im MaterialManager Ordner sind)
cat database/schema.sql | railway run mysql -h $MYSQLHOST -P $MYSQLPORT -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE

# ODER interaktiv:
railway run mysql -h $MYSQLHOST -P $MYSQLPORT -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE
# Dann: source /workspaces/MaterialManager/database/schema.sql
```

**Methode 3 - Direkt von Codespaces:**
```bash
# Holen Sie die MySQL Verbindungsdaten aus Railway und setzen Sie sie hier ein:
mysql -h [HOST] -P [PORT] -u root -p[PASSWORD] railway < /workspaces/MaterialManager/database/schema.sql
```

**Methode 4 - Railway Web Interface (falls verfügbar):**
1. Öffnen Sie Ihren **MySQL Service** in Railway
2. Suchen Sie nach **"Query"**, **"Data"** oder **"PostgreSQL/MySQL"** Tab
3. Falls vorhanden, können Sie dort SQL ausführen
4. Fügen Sie den Inhalt von `database/schema.sql` ein und führen Sie aus

** So überprüfen Sie ob es funktioniert hat:**
```bash
# Verbinden Sie sich mit MySQL
mysql -h [HOST] -P [PORT] -u root -p

# Diese Befehle ausführen:
USE railway;
SHOW TABLES;
# Sie sollten sehen: categories, materials, cabinets, companies, etc.

SELECT COUNT(*) FROM categories;
# Sollte 6 zurückgeben

SELECT COUNT(*) FROM cabinets;
# Sollte 4 zurückgeben
```

## 5. Fertig! 

Öffnen Sie Ihre Frontend-URL und legen Sie los!

---

## Wichtige URLs

Notieren Sie sich:
- Frontend: `https://_____.up.railway.app`
- Backend: `https://_____.up.railway.app`
- MySQL: (intern)

## Bei Änderungen

Einfach pushen:
```bash
git add .
git commit -m "Update"
git push
```

Railway deployt automatisch neu! 
