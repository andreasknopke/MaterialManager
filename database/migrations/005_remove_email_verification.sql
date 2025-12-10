-- Migration 005: E-Mail-Verifizierung entfernen
-- Vereinfacht das User-System, da der Root-Admin alle User manuell anlegt

-- E-Mail-Verifizierungs-Spalten aus users-Tabelle entfernen (einzeln, da DROP IF EXISTS nicht unterstützt)
ALTER TABLE users DROP COLUMN email_verification_token;
ALTER TABLE users DROP COLUMN email_verification_expires;
ALTER TABLE users DROP COLUMN password_reset_token;
ALTER TABLE users DROP COLUMN password_reset_expires;

-- Alle bestehenden User als verifiziert markieren
UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE;

-- Migration completed
SELECT '✅ Migration 005: E-Mail-Verifizierung entfernt' AS status;
