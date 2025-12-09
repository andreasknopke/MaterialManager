# ⚡ Railway Schnellstart

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
- Fertig! ✅

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

**Option A - Railway Query Editor:**
1. Öffnen Sie MySQL Service → **Query** Tab
2. Kopieren Sie Inhalt von `database/schema.sql`
3. Fügen Sie ein und führen Sie aus

**Option B - Railway CLI:**
```bash
npm i -g @railway/cli
railway login
railway link
# Kopieren Sie die MySQL Credentials aus Railway Dashboard
mysql -h [HOST] -u [USER] -p[PASSWORD] [DATABASE] < database/schema.sql
```

## 5. Fertig! 🎉

Öffnen Sie Ihre Frontend-URL und legen Sie los!

---

## 📝 Wichtige URLs

Notieren Sie sich:
- ✅ Frontend: `https://_____.up.railway.app`
- ✅ Backend: `https://_____.up.railway.app`
- ✅ MySQL: (intern)

## 🔄 Bei Änderungen

Einfach pushen:
```bash
git add .
git commit -m "Update"
git push
```

Railway deployt automatisch neu! ✨
