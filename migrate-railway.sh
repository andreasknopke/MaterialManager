#!/bin/bash

# Railway Database Migration Script
# Applies migration 002_add_units_system.sql to the Railway database

echo "🔄 Starting database migration on Railway..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

# Extract connection details from DATABASE_URL
# Format: mysql://user:password@host:port/database
DB_URL=$DATABASE_URL

echo "📊 Applying migration: 002_add_units_system.sql"

# Apply migration using mysql client
mysql $DB_URL < database/migrations/002_add_units_system.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
else
    echo "❌ Migration failed!"
    exit 1
fi

echo "🎉 Database is now up to date!"
