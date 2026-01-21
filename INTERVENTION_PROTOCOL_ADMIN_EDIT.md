# Admin-Funktion: Interventionsprotokolle bearbeiten

## Übersicht

Administratoren können jetzt Datum und Patienteninformationen in Interventionsprotokollen nachträglich bearbeiten. Alle Änderungen werden im Audit-Log dokumentiert.

## Funktionalität

### Backend (API)

**Endpoint:** `PUT /api/interventions/:id`

**Berechtigungen:** Nur Administratoren (`role === 'admin'`) oder Root-Benutzer

**Request Body:**
```json
{
  "patient_id": "string (optional)",
  "patient_name": "string (optional)",
  "notes": "string (optional)",
  "started_at": "string (optional, ISO 8601 DateTime)"
}
```

**Funktionen:**
- Aktualisiert die Felder `patient_id`, `patient_name`, `notes` und `started_at`
- Lädt die alten Werte vor der Aktualisierung
- Vergleicht alte und neue Werte - nur geänderte Felder werden aktualisiert
- Erstellt einen Audit-Log-Eintrag mit alten und neuen Werten
- Gibt detaillierte Fehlermeldungen zurück

**Audit-Log:**
- **Aktion:** `UPDATE`
- **Entity Type:** `INTERVENTION`
- **Alte Werte:** Enthält die ursprünglichen Werte aller geänderten Felder
- **Neue Werte:** Enthält die aktualisierten Werte
- **Benutzer:** Der Admin, der die Änderung durchgeführt hat
- **IP-Adresse & User-Agent:** Werden automatisch erfasst

### Frontend (UI)

**Seite:** Interventionsprotokolle (`/protocols`)

**Neue Features:**
1. **Edit-Button:** Neben jedem Protokoll in der Tabelle (nur für Admins sichtbar)
2. **Edit-Dialog:** Modal-Dialog mit folgenden Feldern:
   - Patienten-ID (erforderlich)
   - Patientenname (optional)
   - Datum und Uhrzeit
   - Notizen (optional)

**Benutzeroberfläche:**
- Warnung im Dialog: "Diese Änderungen werden im Audit-Log dokumentiert"
- Erfolgs-/Fehlermeldungen
- Automatisches Neuladen der Protokoll-Liste nach erfolgreicher Aktualisierung
- Deaktivierung aller Felder während des Speichervorgangs

## Sicherheit

✅ **Berechtigungsprüfung im Backend:** Nur Admins und Root-User können Protokolle bearbeiten

✅ **Audit-Logging:** Alle Änderungen werden mit Zeitstempel, Benutzer, alten und neuen Werten protokolliert

✅ **Frontend-Sichtbarkeit:** Edit-Button wird nur für Admins angezeigt (`isAdmin` Check)

✅ **Validierung:** Patienten-ID ist ein Pflichtfeld

## Verwendung

### Als Administrator:

1. Navigiere zu **Interventionsprotokolle** (`/protocols`)
2. Klicke auf den **Bearbeiten-Button** (Stift-Icon) neben dem gewünschten Protokoll
3. Ändere die erforderlichen Felder im Dialog
4. Klicke auf **Speichern**
5. Die Änderungen werden sofort gespeichert und im Audit-Log dokumentiert

### Audit-Log prüfen:

1. Navigiere zu **Audit-Log** (`/audit-logs`)
2. Filtere nach:
   - **Aktion:** `UPDATE`
   - **Entity Type:** `INTERVENTION`
3. Klicke auf **Details** bei einem Eintrag, um alte und neue Werte zu sehen

## Technische Details

### Geänderte Dateien:

**Backend:**
- `backend/src/routes/intervention.routes.ts`
  - Import von `auditIntervention` hinzugefügt
  - PUT-Route erweitert mit Admin-Prüfung und Audit-Logging
  - Alte Werte werden vor Update abgerufen
  - Nur geänderte Felder werden aktualisiert

**Frontend:**
- `frontend/src/pages/InterventionProtocols.tsx`
  - Import von `useAuth`, `SaveIcon`, `CancelIcon` hinzugefügt
  - State für Edit-Dialog hinzugefügt
  - `handleOpenEdit` und `handleUpdateProtocol` Funktionen
  - Edit-Button in Tabelle (nur für Admins)
  - Neuer Edit-Dialog mit Formularfeldern

- `frontend/src/services/api.ts`
  - `updateProtocol` Funktion zum `interventionAPI` Objekt hinzugefügt

### Audit-Log Schema:

```typescript
{
  user_id: number,
  username: string,
  action: 'UPDATE',
  entity_type: 'INTERVENTION',
  entity_id: number,
  entity_name: 'Intervention #123',
  old_values: {
    patient_id?: string,
    patient_name?: string,
    notes?: string,
    started_at?: string
  },
  new_values: {
    patient_id?: string,
    patient_name?: string,
    notes?: string,
    started_at?: string
  },
  ip_address: string,
  user_agent: string,
  created_at: timestamp
}
```

## Beispiel API-Aufruf

```bash
curl -X PUT https://api.example.com/api/interventions/123 \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "P12345",
    "patient_name": "Max Mustermann",
    "started_at": "2026-01-21T10:30:00",
    "notes": "Korrigierte Patientendaten"
  }'
```

## Hinweise

⚠️ **Wichtig:** Das `ended_at` Datum kann nicht über diese Funktion geändert werden, da es den Zeitpunkt der Intervention-Beendigung repräsentiert.

ℹ️ **Tipp:** Nutze das Audit-Log regelmäßig, um alle Änderungen an Interventionsprotokollen nachzuvollziehen.

## Status

✅ **Implementiert und getestet**
- Backend-API mit Admin-Prüfung und Audit-Logging
- Frontend-UI mit Edit-Dialog
- TypeScript-Fehlerfreiheit bestätigt
- Integration mit bestehendem Audit-Log-System
