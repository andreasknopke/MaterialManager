# 401 Error Debugging

## Problem
Nach Login kommen 401 Errors bei Material/Cabinet API-Calls.

## Mögliche Ursachen

### 1. Railway Backend nicht aktuell
Das Backend auf Railway hat vielleicht noch die alte Version ohne die Fixes.

**Test:**
Öffne https://materialmanager-production.up.railway.app und melde dich an.
Wenn 401 Errors → Railway muss neu deployt werden.

### 2. Lokales Backend läuft nicht
Wenn du `http://localhost:3000` öffnest, muss das Backend auf Port 3001 laufen.

**Test:**
```bash
curl http://localhost:3001/api/health
```

Wenn Fehler → Backend starten:
```bash
cd /workspaces/MaterialManager/backend
npm run dev
```

### 3. Session-Tabelle Problem
Die authenticate Middleware lädt User-Daten, aber die Query schlägt fehl.

**Fix für Railway:**
```bash
# Prüfe ob department_id existiert
mysql -h interchange.proxy.rlwy.net -P 13539 -u root -p'xKrHQwGjwlSjkrEgXzCftMYHshMvhtqn' material_manager -e "DESCRIBE users;"
```

## Schnelltest

1. **Öffne Browser DevTools** (F12)
2. **Network Tab** öffnen
3. **Neu einloggen**
4. **Suche nach `/api/auth/login` Request**
5. **Schau dir die Response an** - enthält sie `isRoot: true`?
6. **Kopiere das Token** aus der Response
7. **Teste manuell:**

```bash
# Ersetze TOKEN_HIER mit deinem Token
curl http://localhost:3001/api/materials \
  -H "Authorization: Bearer TOKEN_HIER" \
  -s | head -20
```

Wenn das funktioniert → Problem ist im Frontend
Wenn 401 → Problem ist im Backend

## Nächste Schritte

Bitte teste:
1. Auf welcher URL bist du? (localhost oder Railway)
2. Läuft das Backend lokal?
3. Was zeigt die `/api/auth/login` Response im Network Tab?
