# Material Manager - Angiographie

Ein umfassendes Materialmanagementsystem für Angiographie-Abteilungen mit Barcode-Integration, entwickelt mit React, Node.js/Express und MySQL.

## 🎯 Funktionen

### Kernfunktionen
- ✅ **Materialverwaltung** - Vollständige CRUD-Operationen für Materialien
- ✅ **Schrankorganisation** - Konfigurierbare Schränke mit Standortverwaltung
- ✅ **Barcode-Integration** - Scannen und Verwalten von Barcodes (EAN, CODE128, QR, etc.)
- ✅ **Ein-/Ausgangsbuchungen** - Bestandsverfolgung mit Transaktionshistorie
- ✅ **Kategorisierung** - Flexible Kategorien und Firmenverwaltung
- ✅ **Bestandsüberwachung** - Automatische Warnungen bei niedrigem Bestand
- ✅ **Verfallsdatum-Tracking** - Überwachung ablaufender Materialien
- ✅ **Konfigurierbare Felder** - Benutzerdefinierte Felder für spezifische Anforderungen
- ✅ **Berichte** - Übersichten und Auswertungen

### Materialinformationen
Für jedes Material können folgende Daten erfasst werden:
- Bezeichnung, Beschreibung
- Kategorie (z.B. Katheter, Führungsdrähte, Schleusen)
- Firma/Hersteller
- Größe, Einheit
- Artikelnummer, Chargennummer
- Aktueller Bestand, Mindestbestand
- Verfallsdatum
- Schrank-Zuordnung mit Position
- Barcodes (mehrere pro Material)
- Benutzerdefinierte Felder

## 🏗️ Technologie-Stack

### Backend
- **Node.js** mit **Express.js**
- **TypeScript** für Type-Safety
- **MySQL 8.0** Datenbank
- RESTful API-Design
- Transaktionsmanagement

### Frontend
- **React 18** mit **TypeScript**
- **Material-UI (MUI)** für moderne UI-Komponenten
- **React Router** für Navigation
- **Axios** für API-Kommunikation
- **MUI DataGrid** für Tabellendarstellung

### DevOps
- **Docker** & **Docker Compose** für Container-Orchestrierung
- **Nginx** als Reverse Proxy für das Frontend

## 📋 Voraussetzungen

- Docker & Docker Compose (empfohlen)
- **ODER**
- Node.js 18+ 
- MySQL 8.0+
- npm oder yarn

## 🚀 Installation & Start

### Mit Docker (empfohlen)

1. **Repository klonen**
```bash
git clone <repository-url>
cd MaterialManager
```

2. **Umgebungsvariablen konfigurieren**
```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

3. **Mit Docker Compose starten**
```bash
docker-compose up -d
```

Die Anwendung ist nun verfügbar:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- MySQL: localhost:3306

### Manuelle Installation

#### Backend einrichten

```bash
cd backend
npm install
cp .env.example .env
# .env Datei anpassen mit Ihren Datenbank-Credentials
npm run dev
```

#### Datenbank initialisieren

```bash
mysql -u root -p < database/schema.sql
```

#### Frontend einrichten

```bash
cd frontend
npm install
cp .env.example .env
# .env Datei anpassen
npm start
```

## 📚 API-Dokumentation

### Basis-URL
```
http://localhost:3001/api
```

### Endpunkte

#### Materialien
- `GET /materials` - Alle Materialien abrufen (mit optionalen Filtern)
- `GET /materials/:id` - Material nach ID
- `POST /materials` - Neues Material erstellen
- `PUT /materials/:id` - Material aktualisieren
- `DELETE /materials/:id` - Material deaktivieren
- `POST /materials/:id/stock-in` - Eingang buchen
- `POST /materials/:id/stock-out` - Ausgang buchen
- `GET /materials/:id/transactions` - Transaktionshistorie
- `GET /materials/reports/expiring` - Ablaufende Materialien
- `GET /materials/reports/low-stock` - Materialien mit niedrigem Bestand

#### Schränke
- `GET /cabinets` - Alle Schränke
- `GET /cabinets/:id` - Schrank nach ID
- `GET /cabinets/:id/materials` - Materialien eines Schranks
- `POST /cabinets` - Neuen Schrank erstellen
- `PUT /cabinets/:id` - Schrank aktualisieren
- `DELETE /cabinets/:id` - Schrank deaktivieren

#### Barcodes
- `GET /barcodes/search/:barcode` - Barcode suchen
- `GET /barcodes/material/:materialId` - Barcodes eines Materials
- `POST /barcodes` - Neuen Barcode erstellen
- `PUT /barcodes/:id` - Barcode aktualisieren
- `DELETE /barcodes/:id` - Barcode löschen
- `POST /barcodes/scan-out` - Barcode scannen und Ausgang buchen

#### Kategorien
- `GET /categories` - Alle Kategorien
- `POST /categories` - Neue Kategorie
- `PUT /categories/:id` - Kategorie aktualisieren
- `DELETE /categories/:id` - Kategorie löschen

#### Firmen
- `GET /companies` - Alle Firmen
- `POST /companies` - Neue Firma
- `PUT /companies/:id` - Firma aktualisieren
- `DELETE /companies/:id` - Firma löschen

#### Feldkonfigurationen
- `GET /field-configs` - Alle benutzerdefinierten Felder
- `POST /field-configs` - Neues Feld erstellen
- `PUT /field-configs/:id` - Feld aktualisieren
- `DELETE /field-configs/:id` - Feld deaktivieren

### Beispiel-Request: Material-Ausgang

```bash
curl -X POST http://localhost:3001/api/materials/1/stock-out \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 5,
    "reference_number": "OP-2024-001",
    "notes": "Für Angiographie-Eingriff",
    "user_name": "Dr. Müller"
  }'
```

## 🗄️ Datenbankstruktur

### Haupttabellen
- `materials` - Materialinformationen
- `cabinets` - Schrankdefinitionen
- `categories` - Materialkategorien
- `companies` - Firmen/Hersteller
- `barcodes` - Barcode-Zuordnungen
- `material_transactions` - Ein-/Ausgangsbuchungen
- `material_custom_fields` - Benutzerdefinierte Feldwerte
- `field_configurations` - Konfiguration benutzerdefinierter Felder
- `users` - Benutzerverwaltung (für zukünftige Authentifizierung)

### Views
- `v_materials_overview` - Umfassende Materialübersicht
- `v_expiring_materials` - Ablaufende Materialien
- `v_low_stock_materials` - Materialien mit niedrigem Bestand

## 📱 Benutzeroberfläche

### Dashboard
- Übersicht mit wichtigen Kennzahlen
- Schnellzugriff auf kritische Bereiche

### Materialverwaltung
- Tabellarische Übersicht aller Materialien
- Suchfunktion
- Filterung nach Kategorie, Schrank, Firma
- Statusanzeige (OK, Niedriger Bestand, Ablaufend)

### Barcode-Scanner
- Manuelle Eingabe oder Scan-Integration
- Material-Lookup
- Schnelle Ausgangsbuchung

### Berichte
- Materialien mit niedrigem Bestand
- Ablaufende Materialien (90-Tage-Warnung)
- Exportfähige Übersichten

## 🔧 Konfiguration

### Backend (.env)
```env
PORT=3001
NODE_ENV=development
DB_HOST=mysql
DB_PORT=3306
DB_USER=materialmanager
DB_PASSWORD=secure_password
DB_NAME=material_manager
JWT_SECRET=your_secret_key
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:3001/api
```

## 🛠️ Entwicklung

### Backend entwickeln
```bash
cd backend
npm run dev  # Startet mit hot-reload
```

### Frontend entwickeln
```bash
cd frontend
npm start  # Startet Development Server
```

### Build für Produktion
```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

## 📊 Features & Erweiterungen

### Geplante Features
- [ ] Benutzer-Authentifizierung & Autorisierung
- [ ] Barcode-Generierung (automatisch)
- [ ] PDF-Export von Berichten
- [ ] E-Mail-Benachrichtigungen bei niedrigem Bestand
- [ ] Inventur-Funktion
- [ ] Lieferantenverwaltung mit Bestellintegration
- [ ] Mobile App

## 🐛 Fehlerbehebung

### Datenbank-Verbindungsfehler
```bash
# MySQL Container-Logs prüfen
docker logs material_manager_db

# Backend-Logs prüfen
docker logs material_manager_backend
```

### Frontend kann Backend nicht erreichen
- CORS-Einstellungen in `backend/.env` prüfen
- API-URL in `frontend/.env` überprüfen

## 📄 Lizenz

Dieses Projekt steht unter der ISC-Lizenz.

## 👥 Kontakt & Support

Für Fragen oder Support öffnen Sie bitte ein Issue im Repository.

---

**Entwickelt für medizinische Angiographie-Abteilungen** 🏥
