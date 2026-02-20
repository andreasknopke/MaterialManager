# Railway Deployment - Material Manager

## Schritt-für-Schritt Anleitung

### 1⃣ Projekt zu GitHub pushen

```bash
cd /workspaces/MaterialManager

# Initialisiere Git (falls noch nicht geschehen)
git init
git add .
git commit -m "Initial commit: Material Manager System"

# Erstelle ein GitHub Repository und pushe
git remote add origin https://github.com/andreasknopke/MaterialManager.git
git branch -M main
git push -u origin main
```

### 2⃣ Railway Dashboard öffnen

1. Gehen Sie zu [railway.app](https://railway.app)
2. Melden Sie sich an
3. Klicken Sie auf **"New Project"**

### 3⃣ MySQL Datenbank erstellen

1. Klicken Sie auf **"+ New"** → **"Database"** → **"Add MySQL"**
2. Die Datenbank wird automatisch erstellt
3. Notieren Sie sich die Verbindungsvariablen (werden automatisch gesetzt)

### 4⃣ Backend Service deployen

1. Klicken Sie auf **"+ New"** → **"GitHub Repo"**
2. Wählen Sie Ihr `MaterialManager` Repository
3. Railway erkennt automatisch das Projekt
4. **Wichtig:** Setzen Sie den Root Directory auf `backend`
   - Gehen Sie zu **Settings** → **Build** → **Root Directory**: `backend`

5. **Umgebungsvariablen setzen:**
   - Gehen Sie zu **Variables** Tab
   - Fügen Sie hinzu:
     ```
     NODE_ENV=production
     PORT=3001
     JWT_SECRET=ihr_super_geheimer_jwt_key_hier_aendern
     CORS_ORIGIN=*
     ```
   
6. **MySQL Verbindung herstellen:**
   - Railway erstellt automatisch diese Variablen wenn Sie MySQL verbinden:
     - `MYSQLHOST` → umbenennen zu `DB_HOST`
     - `MYSQLPORT` → umbenennen zu `DB_PORT`
     - `MYSQLUSER` → umbenennen zu `DB_USER`
     - `MYSQLPASSWORD` → umbenennen zu `DB_PASSWORD`
     - `MYSQLDATABASE` → umbenennen zu `DB_NAME`
   
   ODER manuell verlinken:
   - Klicken Sie auf das Backend Service
   - **Settings** → **Connect** → Wählen Sie die MySQL Datenbank

7. Deploy wird automatisch gestartet

### 5⃣ Frontend Service deployen

1. Klicken Sie wieder auf **"+ New"** → **"GitHub Repo"**
2. Wählen Sie dasselbe `MaterialManager` Repository
3. **Wichtig:** Setzen Sie den Root Directory auf `frontend`
   - **Settings** → **Build** → **Root Directory**: `frontend`

4. **Umgebungsvariablen setzen:**
   - Gehen Sie zu **Variables** Tab
   - Fügen Sie hinzu:
     ```
     REACT_APP_API_URL=https://ihr-backend-service.up.railway.app/api
     ```
   - Ersetzen Sie `ihr-backend-service.up.railway.app` mit der URL Ihres Backend-Services

5. **Wichtig:** Installieren Sie `serve` für das Hosting:
   - Das ist bereits in der `nixpacks.toml` konfiguriert

### 6⃣ Datenbank initialisieren

Nach dem ersten Deploy:

1. Öffnen Sie die **MySQL Datenbank** in Railway
2. Klicken Sie auf **Query** Tab (oder verwenden Sie einen MySQL Client)
3. Führen Sie das Schema aus:
   - Kopieren Sie den Inhalt von `database/schema.sql`
   - Fügen Sie ihn in die Query ein
   - Führen Sie aus

**ODER** verwenden Sie Railway CLI:

```bash
# Railway CLI installieren
npm i -g @railway/cli

# Login
railway login

# Mit Projekt verbinden
railway link

# Schema hochladen
railway run mysql -h $MYSQLHOST -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE < database/schema.sql
```

### 7⃣ Domains konfigurieren

1. **Backend Domain:**
   - Gehen Sie zum Backend Service
   - **Settings** → **Networking** → **Generate Domain**
   - Kopieren Sie die URL (z.B. `material-manager-backend.up.railway.app`)

2. **Frontend Domain:**
   - Gehen Sie zum Frontend Service
   - **Settings** → **Networking** → **Generate Domain**
   - Kopieren Sie die URL (z.B. `material-manager.up.railway.app`)

3. **Frontend Umgebungsvariable aktualisieren:**
   - Gehen Sie zum Frontend Service → **Variables**
   - Aktualisieren Sie `REACT_APP_API_URL`:
     ```
     REACT_APP_API_URL=https://material-manager-backend.up.railway.app/api
     ```
   - Speichern (triggert automatischen Re-Deploy)

### 8⃣ CORS im Backend aktualisieren (Optional)

Wenn Sie Probleme mit CORS haben:

1. Gehen Sie zum Backend Service → **Variables**
2. Ändern Sie `CORS_ORIGIN`:
   ```
   CORS_ORIGIN=https://material-manager.up.railway.app
   ```
   ODER lassen Sie es auf `*` für alle Origins

### 9⃣ Testen

1. Öffnen Sie die Frontend-URL in Ihrem Browser
2. Sie sollten das Material Manager Dashboard sehen
3. Testen Sie die Funktionen

---

## Alternative: Alles mit Railway CLI

```bash
# Railway CLI installieren
npm i -g @railway/cli

# Login
railway login

# Neues Projekt erstellen
railway init

# MySQL hinzufügen
railway add --database mysql

# Backend deployen
cd backend
railway up

# Frontend deployen (in neuem Terminal)
cd frontend
railway up
```

---

## Projekt-Struktur auf Railway

```
MaterialManager (GitHub Repo)
├── MySQL Database Service
│   └── Automatisch konfiguriert
├── Backend Service
│   ├── Root: /backend
│   ├── Build: npm install && npm run build
│   ├── Start: npm start
│   └── Port: 3001
└── Frontend Service
    ├── Root: /frontend
    ├── Build: npm install && npm run build
    ├── Start: serve -s build
    └── Port: 3000
```

---

## Wichtige Hinweise

1. **Kosten:** Railway bietet $5 kostenloses Guthaben/Monat. Danach wird abgerechnet.

2. **Automatische Deploys:** 
   - Jeder Push zu GitHub triggert automatisch einen Deploy
   - Kann in Settings → Deploys deaktiviert werden

3. **Logs überwachen:**
   - Klicken Sie auf jeden Service
   - Gehen Sie zum **Deployments** Tab
   - Klicken Sie auf den neuesten Deploy → **View Logs**

4. **Umgebungsvariablen:**
   - Niemals Secrets in Git committen
   - Immer über Railway Variables verwalten

5. **Datenbank Backups:**
   - Railway erstellt automatische Backups
   - Prüfen Sie regelmäßig Ihre Datenbank

---

## 🆘 Troubleshooting

### Backend startet nicht:
- Prüfen Sie die Logs
- Stellen Sie sicher, dass alle Umgebungsvariablen gesetzt sind
- Prüfen Sie MySQL-Verbindung

### Frontend kann Backend nicht erreichen:
- Prüfen Sie `REACT_APP_API_URL` Variable
- Prüfen Sie CORS-Einstellungen im Backend
- Prüfen Sie ob Backend-Service läuft

### Datenbank-Verbindungsfehler:
- Stellen Sie sicher, dass Backend und MySQL verbunden sind
- Prüfen Sie DB_* Umgebungsvariablen
- Prüfen Sie MySQL Service Status

---

## Nach erfolgreichem Deploy

Ihre Material Manager Anwendung läuft jetzt auf:
- **Frontend:** https://ihr-frontend.up.railway.app
- **Backend:** https://ihr-backend.up.railway.app
- **MySQL:** Internes Railway Netzwerk

Viel Erfolg! 
