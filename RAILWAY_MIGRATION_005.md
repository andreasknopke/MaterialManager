# Migration 005 auf Railway ausführen

## Anleitung

1. **Railway Dashboard öffnen**
   - Gehe zu https://railway.app
   - Öffne dein MaterialManager Projekt
   - Klicke auf den MySQL Service

2. **MySQL Console öffnen**
   - Klicke auf "Data" Tab
   - Klicke auf "Query" Button

3. **Migration ausführen**
   - Kopiere den Inhalt von `railway-migration-005.sql`
   - Füge ihn in die Query Console ein
   - Klicke auf "Run Query"

4. **Ergebnis prüfen**
   - Du solltest sehen: `✅ Migration 005: E-Mail-Verifizierung entfernt`
   - Die Tabelle sollte 1 User mit email_verified = TRUE zeigen

## Was wird geändert?

- **Entfernt werden:**
  - `email_verification_token` Spalte
  - `email_verification_expires` Spalte
  - `password_reset_token` Spalte
  - `password_reset_expires` Spalte

- **Alle User werden automatisch verifiziert:**
  - `email_verified = TRUE` für alle Benutzer

## Warum diese Änderung?

Die E-Mail-Verifizierung ist unnötig, da:
- Der Root-Admin alle Benutzer manuell anlegt
- Kein Self-Service Registration existiert
- Passwort-Reset über Root-Admin erfolgt (manuell)
- `must_change_password` Flag beim ersten Login erzwingt Passwortänderung

## Nach der Migration

Das Backend deployed automatisch auf Railway (via Git Push).
Keine weiteren Schritte nötig - einfach warten bis Railway neu deployed hat (2-3 Minuten).
