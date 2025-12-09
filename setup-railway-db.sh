#!/bin/bash

echo "🗄️  MySQL Datenbank für Railway initialisieren"
echo "=============================================="
echo ""
echo "Bitte geben Sie die MySQL Verbindungsdaten aus Railway ein:"
echo ""

read -p "Host (z.B. containers-us-west-xxx.railway.app): " MYSQL_HOST
read -p "Port (z.B. 6789): " MYSQL_PORT
read -p "Username (meist 'root'): " MYSQL_USER
read -sp "Password: " MYSQL_PASSWORD
echo ""
read -p "Database (meist 'railway'): " MYSQL_DB

echo ""
echo "🔄 Verbinde mit MySQL und importiere Schema..."
echo ""

# Schema importieren
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DB" < database/schema.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Schema erfolgreich importiert!"
    echo ""
    echo "📊 Überprüfe die Datenbank..."
    
    # Tabellen anzeigen
    mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DB" -e "SHOW TABLES;"
    
    echo ""
    echo "📈 Anzahl der Kategorien:"
    mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DB" -e "SELECT COUNT(*) AS kategorien FROM categories;"
    
    echo ""
    echo "📈 Anzahl der Schränke:"
    mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DB" -e "SELECT COUNT(*) AS schränke FROM cabinets;"
    
    echo ""
    echo "🎉 Datenbank erfolgreich eingerichtet!"
else
    echo ""
    echo "❌ Fehler beim Import. Bitte prüfen Sie Ihre Verbindungsdaten."
    exit 1
fi
