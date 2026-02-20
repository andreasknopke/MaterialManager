# Kategorie-basierte Mindestmengen

**Datum:** 11. Dezember 2025  
**Feature:** Category-based Minimum Quantities

## Überblick

Ab sofort werden Mindestmengen **auf Kategorieebene** statt auf Materialebene definiert. Dies entspricht der realen Anforderung in der Angiographie-Abteilung.

### Beispiel

**Vorher (Material-basiert):**
- Pushable Coil 2mm von Firma A, LOT 123, 10cm → Mindestmenge: 1
- Pushable Coil 2mm von Firma A, LOT 456, 10cm → Mindestmenge: 1
- Pushable Coil 2mm von Firma B, LOT 789, 15cm → Mindestmenge: 1

 Problem: Zu granular, schwer zu verwalten

**Jetzt (Kategorie-basiert):**
- Kategorie "Pushable Coils 2mm" → Mindestmenge: 3
- Gesamtbestand aller Materialien in dieser Kategorie: 5
- Status: OK (5 ≥ 3)

## Funktionsweise

### 1. Mindestmenge in Kategorie definieren

In der Kategorieverwaltung (`/categories`):
1. Kategorie öffnen/bearbeiten
2. Feld "Mindestmenge" ausfüllen
3. Beschreibung: "Die Gesamtmenge aller Materialien dieser Kategorie sollte mindestens diesen Wert haben"

### 2. Automatische Berechnung

Das System berechnet automatisch:
```sql
SELECT 
  c.name AS kategorie,
  c.min_quantity AS mindestmenge,
  SUM(m.current_stock) AS gesamtbestand,
  COUNT(m.id) AS anzahl_materialien,
  CASE 
    WHEN SUM(m.current_stock) < c.min_quantity THEN 'Niedrig'
    WHEN SUM(m.current_stock) = 0 THEN 'Leer'
    ELSE 'OK'
  END AS status
FROM categories c
LEFT JOIN materials m ON m.category_id = c.id AND m.active = TRUE
GROUP BY c.id
```

### 3. Dashboard-Anzeige

Das Dashboard zeigt nun:
- **Karte "Kategorien mit niedrigem Bestand":** Anzahl der Kategorien unter Mindestmenge
- **Tabelle:** Detaillierte Ansicht aller Kategorien mit niedrigem Bestand
  - Kategoriename
  - Aktueller Gesamtbestand
  - Mindestmenge
  - Anzahl Materialien
  - Status (Niedrig/Leer)

### 4. Status-Definition

- **OK:** Gesamtbestand ≥ Mindestmenge
- **Niedrig:** Gesamtbestand < Mindestmenge (aber > 0)
- **Leer:** Gesamtbestand = 0

## Technische Implementierung

### Datenbank

**Migration:** `database/migrations/003_add_category_min_quantity.sql`

```sql
ALTER TABLE categories 
ADD COLUMN min_quantity INT DEFAULT 0 
COMMENT 'Mindestmenge für die gesamte Kategorie';

CREATE INDEX idx_min_quantity ON categories(min_quantity);
```

### Backend

**Neue Endpoints:**

```typescript
GET /api/categories/stats/inventory
// Returns: Array of categories with stock statistics

POST /api/admin/run-category-migration
// Führt Migration aus (einmalig)
```

**Response Beispiel:**
```json
[
  {
    "id": 1,
    "name": "Pushable Coils 2mm",
    "description": "...",
    "min_quantity": 3,
    "total_stock": 5,
    "material_count": 3,
    "stock_status": "ok"
  },
  {
    "id": 2,
    "name": "Guide Wires 0.014",
    "description": "...",
    "min_quantity": 10,
    "total_stock": 7,
    "material_count": 5,
    "stock_status": "low"
  }
]
```

### Frontend

**Geänderte Komponenten:**

1. **Categories.tsx:**
   - Neues Feld "Mindestmenge" im Formular
   - Anzeige der Mindestmenge in DataGrid

2. **Dashboard.tsx:**
   - Kategorie-basierte Statistiken statt Material-basiert
   - Tabelle mit Kategorien unter Mindestbestand
   - Klick auf Kategorie → Filterung der Materials-Seite

3. **api.ts:**
   - `categoryAPI.getInventoryStats()` hinzugefügt

## Migration auf Production

### Schritt 1: Code Deploy
 Code wurde bereits deployed (Commit: 60ba43c)

### Schritt 2: Datenbank-Migration ausführen

**Option A: Via Admin-Panel (Empfohlen)**
1. Als Root-User einloggen
2. Navigiere zu `/admin`
3. Klicke "Kategorie-Migration ausführen"
4. Migration komplett

**Option B: Via Railway Dashboard**
1. Railway Dashboard öffnen
2. MySQL Service → Connect
3. Migration-SQL manuell ausführen

## Best Practices

### Kategorien sinnvoll anlegen

**Gut:**
- "Pushable Coils 2mm" → Alle 2mm Pushable Coils, unabhängig von Hersteller
- "Guide Wires 0.014" → Alle 0.014 Guide Wires
- "Schleusen 6F" → Alle 6F Schleusen

**Schlecht:**
- "Materialien" → Zu generisch
- "Boston Scientific Pushable Coil 2mm LOT 123" → Zu spezifisch (sollte Material sein)

### Mindestmengen festlegen

Orientierung an:
- **Täglichem Verbrauch:** z.B. 5 Eingriffe/Tag × 2 Coils = 10 Coils Minimum
- **Lieferzeit:** z.B. 1 Woche Lieferzeit → Wochenbedarf als Minimum
- **Kritikalität:** Kritische Materialien → höhere Mindestmenge

### Beispiel-Kalkulation

```
Material: Pushable Coils 2mm
- Durchschnittlicher Verbrauch: 3 pro Tag
- Lieferzeit: 5 Arbeitstage
- Sicherheitspuffer: 50%

Mindestmenge = (3 × 5) × 1.5 = 22.5 ≈ 23 Stück
```

## Vorteile

 **Realitätsnäher:** Entspricht tatsächlichem Lagerbedarf  
 **Einfacher:** Weniger Mindestmengen zu verwalten  
 **Flexibler:** Verschiedene LOTs/Hersteller/Längen einer Kategorie werden zusammengezählt  
 **Übersichtlicher:** Dashboard zeigt wirklich kritische Kategorien  

## Migration von alten Material-Mindestmengen

Falls alte `min_stock` Werte in Materials existieren:

1. Kategorien identifizieren mit Materialien
2. Maximum der Material-Mindestmengen als Kategorie-Mindestmenge nehmen
3. Optional: `min_stock` Spalte aus Materials-Tabelle entfernen (zukünftig)

**SQL zum Migrieren:**
```sql
UPDATE categories c
SET min_quantity = (
  SELECT COALESCE(MAX(m.min_stock), 0)
  FROM materials m
  WHERE m.category_id = c.id
)
WHERE c.min_quantity = 0;
```

## Rückwärtskompatibilität

- Alte Materialien behalten `min_stock` Feld (wird ignoriert)
- Migration ist nicht-destruktiv
- Kann mehrfach ausgeführt werden
- Defaultwert 0 = keine Warnung

## Support & Troubleshooting

**Problem:** Kategorie zeigt "Niedrig" obwohl genug da ist
- Prüfe: Sind Materialien als `active = TRUE` markiert?
- Lösung: Inaktive Materialien werden nicht mitgezählt

**Problem:** Migration schlägt fehl
- Prüfe: Läuft bereits?
- Lösung: Endpoint gibt Status zurück, ob bereits ausgeführt

**Problem:** Dashboard lädt langsam
- Grund: JOIN über alle Materialien
- Lösung: Index auf `category_id` in Materials (bereits vorhanden)

## Zukünftige Erweiterungen

Mögliche Features:
- Trend-Analyse: Bestandsentwicklung pro Kategorie
- Email-Benachrichtigungen bei niedrigem Bestand
- Verbrauchsprognose basierend auf Historie
- Push-Notifications in App
- Automatische Bestellvorschläge

---

**Status:**  Produktiv  
**Version:** 1.1  
**Commit:** 60ba43c
