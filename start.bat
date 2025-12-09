@echo off
REM Start-Skript für das Material Manager System (Windows)

echo Material Manager wird gestartet...
echo.

REM Stoppe alte Container
echo Stoppe alte Container...
docker-compose down

REM Starte alle Services
echo Starte Services...
docker-compose up -d

REM Warte auf MySQL
echo Warte auf MySQL-Datenbank...
timeout /t 10 /nobreak

REM Zeige Status
echo.
echo Material Manager erfolgreich gestartet!
echo.
echo Zugriff:
echo    Frontend:  http://localhost:3000
echo    Backend:   http://localhost:3001
echo    MySQL:     localhost:3306
echo.
echo Status anzeigen:       docker-compose ps
echo Logs anzeigen:         docker-compose logs -f
echo System stoppen:        docker-compose down
echo.
pause
