-- Migration 005 für Railway Production
-- Im Railway MySQL Console ausführen
-- Entfernt E-Mail-Verifizierung komplett

USE railway;

-- E-Mail-Verifizierungs-Spalten aus users-Tabelle entfernen
ALTER TABLE users 
  DROP COLUMN IF EXISTS email_verification_token,
  DROP COLUMN IF EXISTS email_verification_expires,
  DROP COLUMN IF EXISTS password_reset_token,
  DROP COLUMN IF EXISTS password_reset_expires;

-- Alle bestehenden User als verifiziert markieren
UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE;

-- Status prüfen
SELECT 
  'users' AS table_name,
  COUNT(*) AS total_users,
  SUM(CASE WHEN email_verified = TRUE THEN 1 ELSE 0 END) AS verified_users
FROM users;

SELECT '✅ Migration 005: E-Mail-Verifizierung entfernt' AS status;
