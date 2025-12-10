# GS1 Barcode Integration

## Übersicht

Der Material Manager unterstützt jetzt die automatische Erkennung und Verarbeitung von GS1-128 Barcodes. Diese Funktion ermöglicht es, wichtige Produktinformationen direkt aus dem Barcode auszulesen und automatisch in das Material-Formular einzutragen.

## Unterstützte GS1 Application Identifiers (AI)

Die folgenden Application Identifiers werden automatisch erkannt und verarbeitet:

| AI  | Bezeichnung                          | Beschreibung                                    | Feldname                    |
|-----|--------------------------------------|------------------------------------------------|-----------------------------|
| 01  | GTIN                                | Global Trade Item Number                       | Shipping Container Code     |
| 00  | SSCC                                | Serial Shipping Container Code                 | Shipping Container Code     |
| 10  | Batch/Lot Number                    | Chargennummer                                  | Chargennummer / Lot         |
| 17  | Expiry Date (YYMMDD)               | Verfallsdatum                                  | Verfallsdatum               |
| 11  | Production Date (YYMMDD)           | Produktionsdatum                               | -                           |
| 21  | Serial Number                       | Seriennummer                                   | -                           |

## Verwendung

### Im Material-Erfassungs-Dialog

1. Navigieren Sie zu **Materialien** → **Neues Material**
2. Im Bereich **GS1 Barcode Scanner** können Sie:
   - Einen GS1-Barcode mit einem Scanner einscannen
   - Einen GS1-Barcode manuell eingeben
3. Die Felder werden automatisch ausgefüllt:
   - **Verfallsdatum** (aus AI 17)
   - **Chargennummer / Lot** (aus AI 10)
   - **Shipping Container Code** (aus AI 01 oder 00)

### Beispiel GS1-Barcode

```
]C101041234567890128171231231012345678
```

Dies wird wie folgt geparst:
- AI 01: `04123456789012` (GTIN) → Shipping Container Code
- AI 17: `123123` → Verfallsdatum: 2012-31-23
- AI 10: `12345678` → Chargennummer: 12345678

## Technische Details

### Parser-Funktion

Die GS1-Parser-Logik befindet sich in `/frontend/src/utils/gs1Parser.ts` und bietet:

- `parseGS1Barcode(barcode: string): GS1Data` - Parst einen GS1-Barcode
- `isValidGS1Barcode(barcode: string): boolean` - Validiert einen GS1-Barcode

### Datenbankschema

Das neue Feld `shipping_container_code` wurde zur `materials`-Tabelle hinzugefügt:

```sql
ALTER TABLE materials 
ADD COLUMN shipping_container_code VARCHAR(200);
```

Der Barcode-Typ wurde um `GS1-128` erweitert:

```sql
ALTER TABLE barcodes 
MODIFY COLUMN barcode_type ENUM('EAN13', 'EAN8', 'CODE128', 'GS1-128', 'QR', 'DATAMATRIX');
```

### Migration

Um eine bestehende Datenbank zu aktualisieren:

```bash
mysql -u root -p < database/migrations/001_add_gs1_support.sql
```

## FNC1-Zeichen

GS1-Barcodes verwenden das FNC1-Zeichen als Trennzeichen zwischen Elementen variabler Länge. In verschiedenen Systemen wird dies unterschiedlich dargestellt:

- Als `]C1` am Anfang (AIM Symbology Identifier)
- Als `~` (Tilde)
- Als Steuerzeichen `\x1D` (Group Separator)

Der Parser normalisiert automatisch alle diese Varianten.

## Beispiel-Workflows

### Workflow 1: Material mit GS1-Barcode erstellen

1. Neues Material anlegen
2. GS1-Barcode scannen oder eingeben
3. System liest automatisch Verfallsdatum, Chargennummer und Container-Code aus
4. Restliche Felder manuell ausfüllen (Name, Kategorie, etc.)
5. Speichern

### Workflow 2: Bestehendes Material aktualisieren

1. Material öffnen
2. Auf "Bearbeiten" klicken
3. GS1-Barcode eingeben (überschreibt vorhandene Werte)
4. Änderungen speichern

## Fehlerbehandlung

- **Ungültiger GS1-Barcode**: Warnung wird angezeigt, Felder werden nicht ausgefüllt
- **Fehlende AI**: Nur verfügbare Daten werden extrahiert
- **Ungültiges Datumsformat**: Original-Wert wird beibehalten

## Zukünftige Erweiterungen

Mögliche zukünftige Verbesserungen:

- Unterstützung weiterer AI-Codes (Gewicht, Maße, etc.)
- GS1 DataMatrix und GS1-128 Composite Codes
- Batch-Import über CSV mit GS1-Codes
- Automatische Bestandsbuchung bei Scan
- Integration mit Barcode-Scanner-Hardware

## Siehe auch

- [GS1 General Specifications](https://www.gs1.org/standards/barcodes-epcrfid-id-keys/gs1-general-specifications)
- [Application Identifier Übersicht](https://www.gs1.org/standards/barcodes/application-identifiers)
