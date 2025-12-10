#!/bin/bash
# Run migrations automatically on Railway deployment

echo "🔄 Checking if migrations need to be run..."

# Check if units table exists
RESULT=$(mysql -h $MYSQLHOST -P $MYSQLPORT -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE -se "SHOW TABLES LIKE 'units';" 2>/dev/null)

if [ -z "$RESULT" ]; then
    echo "📊 Running migration: 002_add_units_system.sql"
    mysql -h $MYSQLHOST -P $MYSQLPORT -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE < /app/railway-migration-manual.sql
    echo "✅ Migration completed!"
else
    echo "✓ Units table already exists, skipping migration"
fi

echo "🚀 Starting backend server..."
exec "$@"
