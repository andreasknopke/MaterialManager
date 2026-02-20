# Schnellstart - Material Manager

## Status: MySQL läuft bereits!

Die MySQL-Datenbank ist bereits als Docker-Container gestartet.

```bash
docker ps
# Sie sehen: material_manager_mysql auf Port 3306
```

## Nächste Schritte:

### 1. Backend starten (Terminal 1)

```bash
cd /workspaces/MaterialManager/backend
npm run dev
```

**Erwartete Ausgabe:**
```
 Server läuft auf Port 3001
 Umgebung: development
```

### 2. Frontend Dependencies installieren (Terminal 2)

**Erste Installation (nur einmal nötig):**
```bash
cd /workspaces/MaterialManager/frontend
npm install --legacy-peer-deps
```

Dies kann 2-3 Minuten dauern.

### 3. Frontend starten (Terminal 2)

```bash
npm start
```

**Erwartete Ausgabe:**
```
Compiled successfully!
You can now view material-manager-frontend in the browser.
  Local:            http://localhost:3000
```

## Zugriff

Nach dem Start:

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **MySQL:** localhost:3306

## Backend testen

```bash
curl http://localhost:3001/health
# Sollte zurückgeben: {"status":"OK","timestamp":"..."}
```

## Datenbank-Status prüfen

```bash
docker logs material_manager_mysql
```

## System stoppen

```bash
# Backend: Ctrl+C im Backend-Terminal
# Frontend: Ctrl+C im Frontend-Terminal

# MySQL stoppen:
docker stop material_manager_mysql

# MySQL komplett entfernen:
docker rm material_manager_mysql
```

## Neustart

Wenn Sie alles neu starten möchten:

```bash
# MySQL neustarten (falls gestoppt)
docker start material_manager_mysql

# Backend
cd /workspaces/MaterialManager/backend
npm run dev

# Frontend (in neuem Terminal)
cd /workspaces/MaterialManager/frontend
npm start
```

## Problemlösung

### Port 3306 bereits belegt
```bash
docker stop material_manager_mysql
docker rm material_manager_mysql
# Dann neu starten
```

### Backend kann Datenbank nicht erreichen
```bash
# Prüfen Sie die .env Datei:
cat /workspaces/MaterialManager/backend/.env
# DB_HOST sollte "localhost" sein
```

### Frontend Dependencies Installation dauert lange
Das ist normal! Die erste Installation kann 2-5 Minuten dauern.
Bei sehr langsamer Installation können Sie alternativ einzelne Pakete installieren.

## Alternativer Ansatz: Nur Backend testen

Wenn Sie zunächst nur das Backend testen möchten:

```bash
cd /workspaces/MaterialManager/backend
npm run dev

# In anderem Terminal:
curl http://localhost:3001/api/categories
curl http://localhost:3001/api/cabinets
```

---

**Nächster Schritt:** Öffnen Sie zwei Terminals und führen Sie Schritt 1 und 2 aus!
