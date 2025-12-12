-- Material Manager Database Schema
-- Erstellt für Angiographie-Abteilung

CREATE DATABASE IF NOT EXISTS material_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE material_manager;

-- Tabelle für Kategorien (pro Abteilung)
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unit_id INT COMMENT 'Abteilungszuordnung - jede Abteilung hat eigene Kategorien',
    name VARCHAR(100) NOT NULL,
    description TEXT,
    min_quantity INT DEFAULT 0 COMMENT 'Mindestmenge für alle Materialien dieser Kategorie',
    ops_code VARCHAR(50) COMMENT 'OPS-Code (Operationen- und Prozedurenschlüssel)',
    zusatzentgelt VARCHAR(50) COMMENT 'Zusatzentgelt (ZE) Code für Krankenhausabrechnung',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_unit_id (unit_id),
    UNIQUE INDEX idx_name_unit (name, unit_id),
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Tabelle für Firmen/Hersteller (pro Abteilung)
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unit_id INT COMMENT 'Abteilungszuordnung',
    name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_unit_id (unit_id),
    UNIQUE INDEX idx_name_unit (name, unit_id),
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Tabelle für Schränke (pro Abteilung)
CREATE TABLE IF NOT EXISTS cabinets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unit_id INT COMMENT 'Abteilungszuordnung',
    name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    description TEXT,
    capacity INT DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_location (location),
    INDEX idx_unit_id (unit_id),
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Tabelle für konfigurierbare Felder
CREATE TABLE IF NOT EXISTS field_configurations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    field_name VARCHAR(100) NOT NULL UNIQUE,
    field_label VARCHAR(100) NOT NULL,
    field_type ENUM('text', 'number', 'date', 'select', 'textarea') NOT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    options TEXT, -- JSON für Select-Optionen
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_display_order (display_order)
) ENGINE=InnoDB;

-- Tabelle für Materialien
-- Feldverwendung für GS1-Barcodes:
-- article_number: GTIN (AI 01) - Global Trade Item Number zur Produktidentifikation
-- lot_number: Batch/Lot Number (AI 10) - Chargennummer
-- shipping_container_code: SSCC (AI 00) - Serial Shipping Container Code (optional)
CREATE TABLE IF NOT EXISTS materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    company_id INT,
    cabinet_id INT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    size VARCHAR(100),
    unit VARCHAR(50),
    min_stock INT DEFAULT 0,
    current_stock INT DEFAULT 0,
    expiry_date DATE,
    lot_number VARCHAR(100) COMMENT 'Chargennummer (GS1 AI 10)',
    article_number VARCHAR(100) COMMENT 'GTIN - Artikelnummer zur Produktidentifikation (GS1 AI 01)',
    location_in_cabinet VARCHAR(100),
    shipping_container_code VARCHAR(200) COMMENT 'SSCC - Serial Shipping Container Code (GS1 AI 00, optional)',
    notes TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    FOREIGN KEY (cabinet_id) REFERENCES cabinets(id) ON DELETE SET NULL,
    INDEX idx_name (name),
    INDEX idx_category (category_id),
    INDEX idx_company (company_id),
    INDEX idx_cabinet (cabinet_id),
    INDEX idx_expiry (expiry_date),
    INDEX idx_article_number (article_number),
    INDEX idx_shipping_container (shipping_container_code)
) ENGINE=InnoDB;

-- Tabelle für benutzerdefinierte Feldwerte
CREATE TABLE IF NOT EXISTS material_custom_fields (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    field_config_id INT NOT NULL,
    field_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (field_config_id) REFERENCES field_configurations(id) ON DELETE CASCADE,
    UNIQUE KEY unique_material_field (material_id, field_config_id),
    INDEX idx_material (material_id)
) ENGINE=InnoDB;

-- Tabelle für Barcodes
CREATE TABLE IF NOT EXISTS barcodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    barcode VARCHAR(200) NOT NULL UNIQUE,
    barcode_type ENUM('EAN13', 'EAN8', 'CODE128', 'GS1-128', 'QR', 'DATAMATRIX') DEFAULT 'CODE128',
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    INDEX idx_barcode (barcode),
    INDEX idx_material (material_id)
) ENGINE=InnoDB;

-- Tabelle für Materialein- und ausgänge
CREATE TABLE IF NOT EXISTS material_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    transaction_type ENUM('in', 'out', 'adjustment', 'expired') NOT NULL,
    quantity INT NOT NULL,
    previous_stock INT,
    new_stock INT,
    reference_number VARCHAR(100),
    notes TEXT,
    user_name VARCHAR(100),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    INDEX idx_material (material_id),
    INDEX idx_type (transaction_type),
    INDEX idx_date (transaction_date)
) ENGINE=InnoDB;

-- Tabelle für Benutzer (optional, für zukünftige Authentifizierung)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150),
    role ENUM('admin', 'user', 'viewer') DEFAULT 'user',
    active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB;

-- Initiale Daten für Kategorien
INSERT INTO categories (name, description) VALUES
    ('Katheter', 'Verschiedene Kathetertypen für Angiographie'),
    ('Führungsdrähte', 'Guide Wires und Drähte'),
    ('Schleusen', 'Einführschleusen verschiedener Größen'),
    ('Kontrastmittel', 'Radiologische Kontrastmittel'),
    ('Verbrauchsmaterial', 'Allgemeines medizinisches Verbrauchsmaterial'),
    ('Stents', 'Gefäßstents und Implantate');

-- Initiale Daten für Standard-Feldkonfigurationen
INSERT INTO field_configurations (field_name, field_label, field_type, is_required, display_order, active) VALUES
    ('sterilization_date', 'Sterilisationsdatum', 'date', FALSE, 1, TRUE),
    ('manufacturer_lot', 'Herstellercharge', 'text', FALSE, 2, TRUE),
    ('storage_temperature', 'Lagertemperatur', 'text', FALSE, 3, TRUE),
    ('sterile', 'Steril', 'select', FALSE, 4, TRUE);

-- Initiale Daten für Schränke
INSERT INTO cabinets (name, location, description, capacity) VALUES
    ('Schrank A1', 'Raum 101', 'Hauptlager für Katheter', 50),
    ('Schrank A2', 'Raum 101', 'Führungsdrähte und Schleusen', 40),
    ('Schrank B1', 'Raum 102', 'Kontrastmittel und Verbrauchsmaterial', 30),
    ('Schrank C1', 'Operationssaal 1', 'OP-Materialien', 25);

-- View für Materialübersicht mit allen relevanten Informationen
CREATE OR REPLACE VIEW v_materials_overview AS
SELECT 
    m.id,
    m.name,
    m.description,
    m.size,
    m.unit,
    m.current_stock,
    m.min_stock,
    m.expiry_date,
    m.lot_number,
    m.article_number,
    m.location_in_cabinet,
    m.active,
    c.name AS category_name,
    co.name AS company_name,
    cab.name AS cabinet_name,
    cab.location AS cabinet_location,
    CASE 
        WHEN m.current_stock <= m.min_stock THEN 'LOW'
        WHEN m.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'EXPIRING'
        ELSE 'OK'
    END AS stock_status,
    m.created_at,
    m.updated_at
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id;

-- View für ablaufende Materialien
CREATE OR REPLACE VIEW v_expiring_materials AS
SELECT 
    m.*,
    c.name AS category_name,
    co.name AS company_name,
    DATEDIFF(m.expiry_date, CURDATE()) AS days_until_expiry
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
WHERE m.expiry_date IS NOT NULL 
    AND m.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
    AND m.active = TRUE
ORDER BY m.expiry_date ASC;

-- View für Materialien mit niedrigem Bestand
CREATE OR REPLACE VIEW v_low_stock_materials AS
SELECT 
    m.*,
    c.name AS category_name,
    co.name AS company_name,
    cab.name AS cabinet_name
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
WHERE m.current_stock <= m.min_stock
    AND m.active = TRUE
ORDER BY (m.current_stock - m.min_stock) ASC;

-- Migration: OPS-Code und Zusatzentgelt Felder für Kategorien hinzufügen
-- ALTER TABLE categories ADD COLUMN IF NOT EXISTS ops_code VARCHAR(50) COMMENT 'OPS-Code (Operationen- und Prozedurenschlüssel)';
-- ALTER TABLE categories ADD COLUMN IF NOT EXISTS zusatzentgelt VARCHAR(50) COMMENT 'Zusatzentgelt (ZE) Code für Krankenhausabrechnung';
