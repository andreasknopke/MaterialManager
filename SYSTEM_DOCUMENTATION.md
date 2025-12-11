# Material Manager - Systemdokumentation

**Stand:** 11. Dezember 2025  
**Version:** 1.0 (Commit: c4130fe + Updates)  
**Status:** Produktiv auf Railway

## ⚠️ WICHTIG: MANDATORY FEATURES

Dieses Dokument beschreibt den **stabilen und produktiven Zustand** des Material Manager Systems. Alle hier beschriebenen Features sind **MANDATORY** und dürfen **NICHT rückgängig gemacht** werden ohne explizite Genehmigung.

---

## 1. Systemübersicht

### Zweck
Material Manager ist ein Angiographie Material Management System zur Verwaltung von:
- Medizinischen Materialien und deren Bestand
- Kategorien und Firmen
- Schränken und Lagerorten
- Barcode-Scanning (GS1-Standard)
- Inventurverwaltung
- Berichtswesen

### Technologie-Stack

**Backend:**
- Node.js 18+
- Express.js mit TypeScript
- MySQL 8.0 Datenbank
- JWT für Authentifizierung
- bcrypt für Passwort-Hashing

**Frontend:**
- React 18 mit TypeScript
- Material-UI (MUI) v5
- React Router v6
- Axios für API-Kommunikation
- react-barcode-reader für Barcode-Scanning

**Deployment:**
- Railway (Backend + Frontend + MySQL)
- Docker Container
- Automatisches Deployment bei Git Push

---

## 2. Authentifizierungs- und Autorisierungssystem

### 2.1 Authentifizierung

**AuthContext** (`frontend/src/contexts/AuthContext.tsx`):
```typescript
interface User {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  role: 'admin' | 'user' | 'viewer';
  isRoot: boolean;
  departmentId: number | null;
  mustChangePassword: boolean;
}
```

**Features:**
- JWT-basierte Authentifizierung
- Token wird im localStorage gespeichert
- Automatisches Token-Hinzufügen zu allen API-Requests via Axios Interceptor
- Automatischer Logout bei 401-Responses
- Session-Wiederherstellung beim Seitenladen

**Login-Flow:**
1. User gibt Credentials ein (`/login`)
2. Backend validiert und gibt JWT-Token zurück
3. Token wird in localStorage gespeichert
4. User-Daten werden in AuthContext geladen
5. Redirect zu Dashboard (`/`)

**Logout-Flow:**
1. User klickt Logout im User-Menu (AppBar)
2. `logout()` Funktion aus AuthContext wird aufgerufen
3. Token wird aus localStorage entfernt
4. User-State wird auf `null` gesetzt
5. Redirect zu `/login`

### 2.2 Route Protection

**ProtectedRoute** (`frontend/src/components/ProtectedRoute.tsx`):
- Schützt alle Routes außer `/login` und `/register`
- Prüft ob User eingeloggt ist
- Optionale `requireAdmin` Prop für Admin-Routes
- Automatischer Redirect zu `/login` wenn nicht authentifiziert

**App.tsx Route-Struktur:**
```typescript
// Public Routes
/login              → Login-Seite
/register           → Registrierung

// Protected Routes (alle User)
/                   → Dashboard
/materials          → Materialliste
/materials/new      → Material anlegen
/materials/:id      → Material-Detail
/materials/:id/edit → Material bearbeiten
/cabinets           → Schränke
/categories         → Kategorien
/companies          → Firmen
/units              → Einheiten
/scanner            → Barcode-Scanner
/reports            → Berichte
/inventory          → Inventur

// Admin Routes (requireAdmin=true)
/admin              → Admin-Panel
/users              → Benutzerverwaltung
```

### 2.3 Backend-Middleware

**auth.ts** (`backend/src/middleware/auth.ts`):
```typescript
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction)
```
- Validiert JWT-Token aus Authorization Header
- Lädt User-Daten aus Datenbank
- Fügt `req.user` mit vollständigen User-Infos hinzu
- Blockiert Zugriff wenn kein/ungültiger Token

**Wichtige User-Properties in req.user:**
```typescript
interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  isRoot: boolean;
  departmentId: number | null;
}
```

---

## 3. Rollen und Berechtigungen

### 3.1 Rollenhierarchie

**Root** (isRoot=true):
- Systemweiter Super-Admin
- **Username:** root
- **Standardpasswort:** root (MUSS nach erstem Login geändert werden!)
- Kann auf ALLES zugreifen, unabhängig von Departments
- Einziger Benutzer der "Datenbank zurücksetzen" nutzen kann
- Kann nicht gelöscht werden
- departmentId = NULL

**Admin** (role='admin', isRoot=false):
- Department-Administrator
- Kann Daten NUR in seinem Department verwalten
- Kann Users in seinem Department anlegen/bearbeiten
- Kann Materialien, Kategorien, Firmen, Schränke seines Departments verwalten
- Hat Zugriff auf `/admin` und `/users` Routes
- **MUSS** ein departmentId haben

**User** (role='user'):
- Normaler Benutzer
- Kann Daten in seinem Department LESEN und BEARBEITEN
- Kann KEINE neuen Kategorien/Firmen/Schränke anlegen
- Kann Materialien bearbeiten (Bestand ändern, etc.)
- Kann Barcode-Scanner nutzen
- **MUSS** ein departmentId haben

**Viewer** (role='viewer'):
- Nur-Lese-Zugriff
- Kann Daten nur ansehen, nicht bearbeiten
- Momentan **nicht aktiv implementiert** (geplant für Zukunft)

### 3.2 Department-System

**Funktionsweise:**
- Jeder Non-Root User ist einem Department zugewiesen
- Departments werden über `cabinets` Tabelle definiert (jeder Schrank = 1 Department)
- User sehen NUR Daten aus ihrem eigenen Department
- Ausnahme: Root sieht ALLES

**Department-Filter** (`backend/src/utils/departmentFilter.ts`):

Zentrale Funktionen für Department-basierte Zugriffskontrolle:

```typescript
// Gibt WHERE-Clause für Department-Filterung zurück
getDepartmentFilter(user: User, tableAlias?: string): string

// Prüft ob User Zugriff auf bestimmtes Department hat
checkDepartmentAccess(user: User, departmentId: number): boolean

// Filtert über cabinet_id (für Materialien)
getDepartmentFilterViaCabinet(user: User, tableAlias?: string): string
```

**Wichtig:**
- Root (isRoot=true) → Filter wird NICHT angewendet
- Non-Root → Filter wird IMMER angewendet
- Leerer Alias ('') wird korrekt behandelt für VIEW-basierte Queries

**Anwendung in Routes:**
- Materials: Filter über `cabinet_id`
- Categories: Filter über `department_id`
- Companies: Filter über `department_id`
- Cabinets: Filter über `id` (cabinet selbst ist das Department)
- Users: Admin sieht nur Users seines Departments

---

## 4. Datenmodell

### 4.1 Kern-Tabellen

**users** - Benutzerverwaltung
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
username        VARCHAR(50) UNIQUE NOT NULL
email           VARCHAR(100) UNIQUE NOT NULL
password_hash   VARCHAR(255) NOT NULL
full_name       VARCHAR(100)
role            ENUM('admin', 'user', 'viewer') DEFAULT 'user'
is_root         BOOLEAN DEFAULT FALSE
department_id   INT NULL (Foreign Key → cabinets.id)
must_change_password BOOLEAN DEFAULT FALSE
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

**cabinets** - Schränke (= Departments)
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
name            VARCHAR(100) NOT NULL
location        VARCHAR(255)
description     TEXT
qr_code         VARCHAR(255) UNIQUE
department_id   INT (Selbstreferenz für Department-Logik)
created_by      INT (Foreign Key → users.id)
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**materials** - Materialien
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
name            VARCHAR(255) NOT NULL
description     TEXT
sku             VARCHAR(100)
barcode         VARCHAR(255) UNIQUE
manufacturer    VARCHAR(255)
catalog_number  VARCHAR(100)
unit_id         INT (Foreign Key → units.id)
min_quantity    INT DEFAULT 0
current_quantity INT DEFAULT 0
reorder_point   INT DEFAULT 0
cabinet_id      INT (Foreign Key → cabinets.id) - DEPARTMENT ZUORDNUNG
category_id     INT (Foreign Key → categories.id)
company_id      INT (Foreign Key → companies.id)
last_checked    TIMESTAMP
created_by      INT (Foreign Key → users.id)
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**categories** - Kategorien
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
name            VARCHAR(100) NOT NULL
description     TEXT
department_id   INT (Foreign Key → cabinets.id für Department-Filter)
created_by      INT (Foreign Key → users.id)
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**companies** - Firmen/Hersteller
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
name            VARCHAR(255) NOT NULL
contact_person  VARCHAR(255)
email           VARCHAR(100)
phone           VARCHAR(50)
address         TEXT
department_id   INT (Foreign Key → cabinets.id für Department-Filter)
created_by      INT (Foreign Key → users.id)
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**units** - Maßeinheiten
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
name            VARCHAR(50) NOT NULL
abbreviation    VARCHAR(20) NOT NULL
description     TEXT
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**barcodes** - Barcode-Zuordnungen
```sql
id              INT PRIMARY KEY AUTO_INCREMENT
barcode         VARCHAR(255) NOT NULL
material_id     INT (Foreign Key → materials.id)
is_primary      BOOLEAN DEFAULT FALSE
created_at      TIMESTAMP
```

### 4.2 Database Views

**materials_view** - Optimierte Material-Übersicht
```sql
SELECT 
  m.*,
  c.name AS category_name,
  comp.name AS company_name,
  cab.name AS cabinet_name,
  u.abbreviation AS unit_abbreviation,
  u.name AS unit_name
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies comp ON m.company_id = comp.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN units u ON m.unit_id = u.id
```

---

## 5. Backend-Architektur

### 5.1 Projektstruktur

```
backend/
├── src/
│   ├── server.ts                    # Express Server Entry Point
│   ├── config/
│   │   └── database.ts              # MySQL Connection Pool
│   ├── middleware/
│   │   └── auth.ts                  # JWT Authentication Middleware
│   ├── routes/
│   │   ├── auth.routes.ts           # Login, Register, Me
│   │   ├── user.routes.ts           # User CRUD
│   │   ├── material.routes.ts       # Material CRUD
│   │   ├── category.routes.ts       # Category CRUD
│   │   ├── company.routes.ts        # Company CRUD
│   │   ├── cabinet.routes.ts        # Cabinet CRUD
│   │   ├── barcode.routes.ts        # Barcode Operations
│   │   └── fieldConfig.routes.ts    # Field Configurations
│   ├── utils/
│   │   └── departmentFilter.ts      # Department Access Control
│   └── types/
│       └── express.d.ts             # TypeScript Type Extensions
├── package.json
└── tsconfig.json
```

### 5.2 Wichtige API-Endpoints

**Authentication:**
```
POST   /api/auth/register           # Neuen User registrieren
POST   /api/auth/login              # Login (returns JWT)
GET    /api/auth/me                 # Aktuellen User abrufen
POST   /api/auth/change-password    # Passwort ändern
```

**Users:**
```
GET    /api/users                   # Alle Users (Department-gefiltert)
GET    /api/users/:id               # Einzelner User
POST   /api/users                   # User anlegen (Admin only)
PUT    /api/users/:id               # User bearbeiten (Admin only)
DELETE /api/users/:id               # User löschen (Admin only, nicht Root)
```

**Materials:**
```
GET    /api/materials               # Alle Materialien (Department-gefiltert)
GET    /api/materials/:id           # Einzelnes Material
POST   /api/materials               # Material anlegen
PUT    /api/materials/:id           # Material bearbeiten
DELETE /api/materials/:id           # Material löschen
PATCH  /api/materials/:id/quantity  # Bestand ändern
```

**Categories:**
```
GET    /api/categories              # Alle Kategorien (Department-gefiltert)
GET    /api/categories/:id          # Einzelne Kategorie
POST   /api/categories              # Kategorie anlegen
PUT    /api/categories/:id          # Kategorie bearbeiten
DELETE /api/categories/:id          # Kategorie löschen
```

**Companies:**
```
GET    /api/companies               # Alle Firmen (Department-gefiltert)
GET    /api/companies/:id           # Einzelne Firma
POST   /api/companies               # Firma anlegen
PUT    /api/companies/:id           # Firma bearbeiten
DELETE /api/companies/:id           # Firma löschen
```

**Cabinets:**
```
GET    /api/cabinets                # Alle Schränke (Department-gefiltert)
GET    /api/cabinets/:id            # Einzelner Schrank
POST   /api/cabinets                # Schrank anlegen
PUT    /api/cabinets/:id            # Schrank bearbeiten
DELETE /api/cabinets/:id            # Schrank löschen
```

**Barcodes:**
```
GET    /api/barcodes/scan/:code     # Barcode scannen und Material finden
POST   /api/barcodes                # Barcode zu Material hinzufügen
DELETE /api/barcodes/:id            # Barcode entfernen
```

**Admin:**
```
POST   /api/admin/reset-database    # Datenbank leeren (Root only)
```

### 5.3 Middleware-Chain

Typische Request-Verarbeitung:
```
Request → CORS → JSON Parser → authenticateToken → Route Handler → Response
```

**authenticateToken prüft:**
1. Authorization Header vorhanden?
2. JWT Token gültig?
3. User existiert in DB?
4. Lädt vollständige User-Daten inkl. isRoot, departmentId

**Department-Filter wird angewendet in:**
- Jeder GET/PUT/DELETE Operation
- Automatisch durch `getDepartmentFilter()` Utilities
- Root-User werden NICHT gefiltert

---

## 6. Frontend-Architektur

### 6.1 Projektstruktur

```
frontend/
├── public/
│   ├── index.html
│   └── config.js                    # Runtime Config für API URL
├── src/
│   ├── App.tsx                      # Main App mit Routing
│   ├── index.tsx                    # Entry Point
│   ├── contexts/
│   │   └── AuthContext.tsx          # Global Auth State
│   ├── components/
│   │   ├── Layout.tsx               # App Layout mit Navigation
│   │   └── ProtectedRoute.tsx       # Route Protection
│   ├── pages/
│   │   ├── Login.tsx                # Login-Seite
│   │   ├── Register.tsx             # Registrierung
│   │   ├── Dashboard.tsx            # Dashboard
│   │   ├── Materials.tsx            # Material-Liste
│   │   ├── MaterialDetail.tsx       # Material-Detail
│   │   ├── MaterialForm.tsx         # Material Erstellen/Bearbeiten
│   │   ├── Cabinets.tsx             # Schrank-Verwaltung
│   │   ├── Categories.tsx           # Kategorie-Verwaltung
│   │   ├── Companies.tsx            # Firmen-Verwaltung
│   │   ├── Units.tsx                # Einheiten-Verwaltung
│   │   ├── BarcodeScanner.tsx       # Barcode-Scanner
│   │   ├── Reports.tsx              # Berichte
│   │   ├── Inventory.tsx            # Inventur
│   │   ├── Admin.tsx                # Admin-Panel
│   │   └── Users.tsx                # User-Verwaltung
│   ├── services/
│   │   └── api.ts                   # Axios Instance mit Interceptors
│   └── utils/
│       └── gs1Parser.ts             # GS1 Barcode Parser
├── package.json
└── tsconfig.json
```

### 6.2 Layout & Navigation

**Layout.tsx:**
- Sidebar mit Navigation (Material-UI Drawer)
- Top AppBar mit:
  - Menu-Icon (Mobile)
  - App-Titel: "Angiographie Material Management"
  - User-Icon mit Dropdown-Menu (Logout)
- Responsive Design (Desktop + Mobile)

**Navigation-Items:**
```typescript
const menuItems = [
  { text: 'Dashboard', icon: DashboardIcon, path: '/' },
  { text: 'Materialien', icon: InventoryIcon, path: '/materials' },
  { text: 'Schränke', icon: StorageIcon, path: '/cabinets' },
  { text: 'Inventur', icon: ChecklistIcon, path: '/inventory' },
  { text: 'Kategorien', icon: CategoryIcon, path: '/categories' },
  { text: 'Firmen', icon: BusinessIcon, path: '/companies' },
  { text: 'Barcode-Scanner', icon: QrCodeScannerIcon, path: '/scanner' },
  { text: 'Berichte', icon: AssessmentIcon, path: '/reports' },
];
```

**User-Menu (nur wenn eingeloggt):**
- Account-Icon (AccountCircle)
- Dropdown mit:
  - ~~Einstellungen~~ (momentan entfernt)
  - Abmelden → Ruft `logout()` aus AuthContext auf

### 6.3 API-Service

**api.ts** - Zentrale Axios Instance:
```typescript
const api = axios.create({
  baseURL: window.API_URL || '/api'
});

// Request Interceptor: Fügt JWT Token hinzu
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Behandelt 401 Errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## 7. Wichtige Features

### 7.1 GS1 Barcode-Unterstützung

**gs1Parser.ts** - Parser für GS1-Barcodes:

Unterstützte Application Identifiers (AI):
- `01` - GTIN (Global Trade Item Number)
- `10` - Batch/Lot Number
- `17` - Expiration Date (YYMMDD)
- `21` - Serial Number
- `30` - Quantity

**Verwendung:**
1. Barcode wird gescannt
2. Parser erkennt GS1-Format
3. Extrahiert GTIN, Lot, Expiry, etc.
4. Sucht Material anhand GTIN
5. Zeigt Material-Details + GS1-Infos an

### 7.2 Dashboard

**Übersicht:**
- Gesamtanzahl Materialien (Department-gefiltert)
- Materialien unter Mindestbestand (Warnung)
- Anzahl Kategorien
- Anzahl Schränke
- Anzahl Firmen

**Karten mit Material-Status:**
- Grün: Ausreichend Bestand
- Orange: Mindestbestand erreicht
- Rot: Kritisch niedriger Bestand

**Listen:**
- Kürzlich aktualisierte Materialien
- Materialien mit niedrigem Bestand

### 7.3 Material-Verwaltung

**Funktionen:**
- Material anlegen/bearbeiten/löschen
- Bestand erhöhen/reduzieren
- Barcode zuweisen
- GS1-Barcodes scannen
- Mindestbestand festlegen
- Kategorie, Firma, Schrank zuordnen
- Einheiten (Units) zuweisen

**Material-Detail-Ansicht:**
- Alle Material-Infos
- Bestandsänderung-Buttons (+ / -)
- Barcode-Anzeige
- Verlinkung zu Kategorie/Firma/Schrank
- Edit/Delete Buttons

### 7.4 Barcode-Scanner

**BarcodeScanner.tsx:**
- Kamera-Zugriff für Barcode-Scanning
- Manuelle Barcode-Eingabe
- GS1-Format-Unterstützung
- Automatische Material-Suche
- Navigation zu Material-Detail nach Scan

### 7.5 Inventur-System

**Inventory.tsx:**
- Liste aller Materialien mit aktuellem Bestand
- Schnelle Bestandsänderung
- Warnung bei niedrigem Bestand
- Export-Funktion (geplant)

### 7.6 Berichte

**Reports.tsx:**
- Bestandsberichte
- Niedrigbestand-Warnungen
- Material-Aktivität
- Export als PDF/Excel (teilweise implementiert)

### 7.7 Admin-Funktionen

**Admin.tsx:**
- **Nur für Root:** Datenbank zurücksetzen
  - Löscht ALLE Daten (Materials, Categories, Companies, Cabinets, Barcodes, Transactions)
  - Erfordert Bestätigungstext: "DATENBANK LÖSCHEN"
  - Nicht rückgängig machbar!
- **Entfernt (Stand 11.12.2025):**
  - ~~User Management Migration~~
  - ~~Units Migration~~
  - ~~Department Migration~~

**Users.tsx:**
- User-Liste (Department-gefiltert für Admins)
- User anlegen/bearbeiten/löschen
- Department zuweisen
- Rolle ändern (admin/user/viewer)
- Passwort zurücksetzen erzwingen

---

## 8. Deployment & Konfiguration

### 8.1 Railway Deployment

**Aktuelle Umgebung:**
- Railway Project: MaterialManager
- MySQL Datenbank:
  - Host: interchange.proxy.rlwy.net
  - Port: 13539
  - Database: material_manager
  - User: xKrHQwGjwlSjkrEgXzCftMYHshMvhtqn

**Services:**
- Backend: Node.js Container
- Frontend: Node.js Container (serves static build)
- MySQL: Railway MySQL Plugin

**Umgebungsvariablen (Backend):**
```
DB_HOST=interchange.proxy.rlwy.net
DB_PORT=13539
DB_USER=xKrHQwGjwlSjkrEgXzCftMYHshMvhtqn
DB_PASSWORD=<password>
DB_NAME=material_manager
JWT_SECRET=<secret>
PORT=3000
NODE_ENV=production
```

**Umgebungsvariablen (Frontend):**
```
REACT_APP_API_URL=<backend-url>
```

### 8.2 Deployment-Prozess

**Automatisches Deployment:**
1. Code zu GitHub pushen
2. Railway erkennt Push auf `main` Branch
3. Backend wird neu gebaut und deployed
4. Frontend wird neu gebaut und deployed
5. Restart der Services

**Build-Befehle:**
- Backend: `npm run build` → `npm start`
- Frontend: `npm run build` → Serve static files

### 8.3 Datenbank-Schema

**Schema-Datei:** `database/schema.sql`

**Wichtige Tabellen im Schema:**
- users (mit is_root, department_id)
- cabinets (Departments)
- materials (mit cabinet_id für Department-Zuordnung)
- categories (mit department_id)
- companies (mit department_id)
- units
- barcodes
- field_configs

**Views:**
- materials_view (optimierte Material-Übersicht)

---

## 9. Wichtige Workflows

### 9.1 User-Anlage durch Admin

1. Admin navigiert zu `/users`
2. Klickt "Neuer Benutzer"
3. Füllt Formular aus:
   - Username (unique)
   - Email (unique)
   - Passwort
   - Rolle (admin/user/viewer)
   - Department (Pflicht für Non-Root)
4. Backend prüft:
   - Admin darf nur Users in seinem eigenen Department anlegen
   - Root darf Users in allen Departments anlegen
5. User wird mit `must_change_password=true` erstellt
6. Beim ersten Login muss User Passwort ändern

### 9.2 Material-Bestellung (Low Stock)

1. Dashboard zeigt Material mit niedrigem Bestand (rot)
2. User klickt auf Material
3. Material-Detail zeigt:
   - Aktueller Bestand
   - Mindestbestand
   - Bestellpunkt
   - Firma (Lieferant)
4. User kann Bestand manuell erhöhen nach Lieferung
5. Status wechselt automatisch zu grün

### 9.3 Barcode-Scan Workflow

1. User navigiert zu `/scanner`
2. Erlaubt Kamera-Zugriff
3. Scannt Barcode
4. System erkennt:
   - Standard-Barcode → Sucht Material nach exakter Barcode-Übereinstimmung
   - GS1-Barcode → Parst GTIN, Lot, Expiry → Sucht Material nach GTIN
5. Zeigt Material-Detail mit GS1-Infos
6. User kann Bestand anpassen

### 9.4 Department-Isolierung

**Szenario:** 2 Departments - "Angio1" und "Angio2"

**Angio1-Admin erstellt Material:**
- Material wird mit `cabinet_id` eines Angio1-Schranks erstellt
- Material ist nur für Angio1-Users sichtbar
- Angio2-Users sehen dieses Material NICHT

**Root-User:**
- Sieht ALLE Materialien aus ALLEN Departments
- Kann Materialien zwischen Departments verschieben (cabinet_id ändern)
- Kann Users in allen Departments verwalten

---

## 10. Sicherheit

### 10.1 Passwort-Sicherheit

- Passwörter werden mit bcrypt gehasht (10 rounds)
- Niemals Plaintext-Passwörter in DB
- JWT-Tokens haben Expiration
- `must_change_password` Flag für neue/zurückgesetzte User

### 10.2 SQL-Injection Prevention

- Alle Queries verwenden Parameterized Statements
- Beispiel: `db.query('SELECT * FROM users WHERE id = ?', [id])`
- Niemals String-Concatenation für SQL

### 10.3 CORS

- CORS ist aktiviert für Frontend-Domain
- Credentials werden erlaubt
- Nur spezifische Origins sind erlaubt (in Production)

### 10.4 Department-Isolation

- Automatische Filterung aller Queries nach departmentId
- Root-User Bypass für System-Administration
- Keine Möglichkeit für Users, andere Departments zu sehen

---

## 11. Bekannte Einschränkungen

### 11.1 Nicht implementierte Features

- **Viewer-Rolle:** Definiert, aber keine spezielle UI-Behandlung
- **Settings-Page:** Wurde entfernt, könnte später für User-Einstellungen genutzt werden
- **Email-Benachrichtigungen:** Keine automatischen Emails bei niedrigem Bestand
- **Audit-Log:** Keine Änderungshistorie (wer hat was wann geändert)
- **2FA:** Keine Zwei-Faktor-Authentifizierung
- **Passwort-Reset:** Keine Passwort-vergessen Funktion

### 11.2 Geplante Verbesserungen

- **View Scope Preference:** Global/Department View Toggle (für später)
- **Material-Transfer:** Materialien zwischen Schränken verschieben
- **Batch-Operationen:** Multiple Materialien gleichzeitig bearbeiten
- **Advanced Reports:** Detailliertere Berichte und Analytics
- **Mobile App:** Native iOS/Android App

---

## 12. Wartung & Troubleshooting

### 12.1 Datenbank-Zugriff

**Via Railway CLI:**
```bash
railway connect
# Dann im MySQL-Container:
mysql -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE
```

### 12.2 Logs

**Backend-Logs (Railway):**
- Railway Dashboard → Backend Service → Logs
- Zeigt alle console.log Ausgaben
- Fehler werden mit Stack-Trace geloggt

**Frontend-Logs:**
- Browser Developer Console
- Network-Tab für API-Requests

### 12.3 Häufige Probleme

**Problem: User kann sich nicht einloggen**
- Prüfe: Username korrekt?
- Prüfe: Passwort korrekt?
- Prüfe: User existiert in DB?
- Prüfe: Backend erreichbar?

**Problem: User sieht keine Daten**
- Prüfe: Hat User ein departmentId?
- Prüfe: Existieren Daten in diesem Department?
- Prüfe: Department-Filter in Backend korrekt?

**Problem: "Unauthorized" Fehler**
- Prüfe: Token in localStorage?
- Prüfe: Token noch gültig?
- Prüfe: Backend-JWT_SECRET korrekt?

### 12.4 Reset zu Werkseinstellungen

**Nur Root kann:**
1. Navigiere zu `/admin`
2. Klicke "Datenbank leeren"
3. Gib "DATENBANK LÖSCHEN" ein
4. Bestätige

**Danach:**
- Alle Daten sind gelöscht
- Root-User bleibt erhalten
- Neue Departments/Materialien müssen angelegt werden

---

## 13. Code-Konventionen

### 13.1 TypeScript

- Strikte Typisierung
- Interfaces für alle Datenstrukturen
- Type-Guards wo sinnvoll
- Keine `any` Types (außer wo unvermeidbar)

### 13.2 React

- Functional Components mit Hooks
- Props-Interfaces für alle Components
- useState für lokalen State
- useContext für globalen State (Auth)
- useEffect für Side-Effects

### 13.3 Naming

- Components: PascalCase (MaterialForm.tsx)
- Functions: camelCase (getDepartmentFilter)
- Constants: UPPER_SNAKE_CASE (JWT_SECRET)
- Database: snake_case (department_id)

### 13.4 Error Handling

**Backend:**
```typescript
try {
  // Operation
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({ error: 'Error message' });
}
```

**Frontend:**
```typescript
try {
  await api.post('/endpoint', data);
  // Success handling
} catch (error: any) {
  setError(error.response?.data?.error || 'Generic error');
}
```

---

## 14. Testing (Aktuell minimal)

### 14.1 Manuelle Tests

**Kritische Workflows:**
- [ ] Login/Logout
- [ ] Material anlegen/bearbeiten/löschen
- [ ] Barcode scannen
- [ ] User anlegen (als Admin)
- [ ] Department-Isolation (User sieht nur eigene Daten)
- [ ] Root kann alles sehen/bearbeiten

### 14.2 Geplant

- Unit Tests (Jest)
- Integration Tests (Supertest)
- E2E Tests (Playwright/Cypress)

---

## 15. Version History

**v1.0 - 11. Dezember 2025 (Commit: c4130fe)**
- Vollständiges Auth-System mit JWT
- Rollen: Root, Admin, User
- Department-basierte Zugriffskontrolle
- Material-Verwaltung mit GS1-Barcodes
- Barcode-Scanner
- Inventur-System
- User-Verwaltung
- Admin-Panel (nur DB-Reset für Root)
- Dashboard mit Statistiken
- Responsive Layout

**Entfernte Features (Stand 11.12.2025):**
- View Scope Preference (wird später neu implementiert)
- Settings Page (wird später neu implementiert)
- Migrations im Admin-Panel (Units, User Management, Department)

---

## 16. Zusammenfassung der MANDATORY Features

**Diese Features dürfen NIEMALS entfernt/gebrochen werden:**

✅ **Authentifizierung:**
- JWT-basiertes Login/Logout
- AuthContext mit User State
- ProtectedRoute für alle Routes außer /login, /register
- Axios Interceptor für automatisches Token-Handling

✅ **Autorisierung:**
- 3 Rollen: Root (isRoot=true), Admin, User
- Root = globaler Super-Admin
- Admin = Department-Admin
- User = normaler Benutzer

✅ **Department-System:**
- Jeder Non-Root User MUSS departmentId haben
- Automatische Filterung aller Daten nach Department
- Root sieht ALLES (kein Filter)
- getDepartmentFilter() Utilities

✅ **Datenmodell:**
- users Tabelle mit is_root, department_id
- cabinets = Departments
- materials mit cabinet_id
- categories, companies mit department_id
- units
- barcodes
- materials_view

✅ **Frontend-Struktur:**
- App.tsx mit AuthProvider Wrapper
- Layout.tsx mit Navigation + User-Menu
- Alle wichtigen Pages (Dashboard, Materials, etc.)
- ProtectedRoute für Route-Schutz

✅ **Backend-Struktur:**
- authenticateToken Middleware
- Department-Filter in allen Routes
- Alle CRUD-Endpoints für Materials, Categories, Companies, Cabinets, Users
- /api/auth/* Endpoints

✅ **GS1-Barcode-Support:**
- gs1Parser.ts
- BarcodeScanner.tsx
- Automatische GTIN-Erkennung

✅ **Admin-Funktionen:**
- Datenbank zurücksetzen (nur Root)
- User-Verwaltung (Department-gefiltert)

---

**Ende der Systemdokumentation**

Diese Dokumentation beschreibt den stabilen, produktiven Zustand des Material Manager Systems. Alle beschriebenen Features sind essentiell für den Betrieb und dürfen nicht ohne explizite Genehmigung entfernt oder geändert werden.

Bei Fragen oder Änderungswünschen bitte immer erst diese Dokumentation konsultieren!
