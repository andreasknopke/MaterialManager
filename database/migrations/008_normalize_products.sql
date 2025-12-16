-- Migration 008: Normalisierung - Produkt-Stammdaten von Material-Instanzen trennen
-- 
-- Problem: Aktuell werden bei gleicher GTIN alle Stammdaten (Name, Hersteller, etc.) 
-- in jeder Zeile wiederholt. Bei Änderungen müssen alle Zeilen aktualisiert werden.
--
-- Lösung: Neue 'products' Tabelle für GTIN-basierte Stammdaten (UNIQUE GTIN)
-- Die 'materials' Tabelle enthält dann nur instanz-spezifische Daten (LOT, Verfallsdatum, Lagerort)

-- ============================================
-- SCHRITT 1: Produkte-Tabelle erstellen
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    gtin VARCHAR(100) NOT NULL UNIQUE,              -- GTIN/Artikelnummer (eindeutig!)
    name VARCHAR(200) NOT NULL,                      -- Produktname
    description TEXT,                                -- Beschreibung
    size VARCHAR(100),                               -- Größe
    company_id INT,                                  -- Hersteller (FK)
    shape_id INT,                                    -- Form/Device-Typ (FK)
    shaft_length VARCHAR(50),                        -- Schaftlänge
    device_length VARCHAR(50),                       -- Gerätlänge
    device_diameter VARCHAR(50),                     -- Gerätdurchmesser
    french_size VARCHAR(20),                         -- French-Größe
    guidewire_acceptance ENUM('0.014in','0.018in','0.032in','0.035in','0.038in'), -- Drahtakzeptanz
    cost DECIMAL(10,2),                              -- Stückkosten
    notes TEXT,                                      -- Notizen zum Produkt
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    FOREIGN KEY (shape_id) REFERENCES shapes(id) ON DELETE SET NULL,
    
    INDEX idx_products_name (name),
    INDEX idx_products_company (company_id)
);

-- ============================================
-- SCHRITT 2: Produkte aus bestehenden Materialien extrahieren
-- Nimmt für jede GTIN den ersten Eintrag als Stammdaten
-- ============================================
INSERT INTO products (gtin, name, description, size, company_id, shape_id, 
                      shaft_length, device_length, device_diameter, french_size, 
                      guidewire_acceptance, cost, notes)
SELECT 
    m.article_number,
    m.name,
    m.description,
    m.size,
    m.company_id,
    m.shape_id,
    m.shaft_length,
    m.device_length,
    m.device_diameter,
    m.french_size,
    m.guidewire_acceptance,
    m.cost,
    m.notes
FROM materials m
WHERE m.article_number IS NOT NULL 
  AND m.article_number != ''
  AND m.id = (
      SELECT MIN(m2.id) 
      FROM materials m2 
      WHERE m2.article_number = m.article_number
  )
ON DUPLICATE KEY UPDATE 
    name = VALUES(name);  -- Falls schon vorhanden, nur aktualisieren

-- ============================================
-- SCHRITT 3: product_id Spalte zu materials hinzufügen
-- ============================================
ALTER TABLE materials 
ADD COLUMN product_id INT NULL AFTER id,
ADD FOREIGN KEY fk_materials_product (product_id) REFERENCES products(id) ON DELETE SET NULL,
ADD INDEX idx_materials_product (product_id);

-- ============================================
-- SCHRITT 4: product_id für bestehende Materialien setzen
-- ============================================
UPDATE materials m
JOIN products p ON m.article_number = p.gtin
SET m.product_id = p.id
WHERE m.article_number IS NOT NULL AND m.article_number != '';

-- ============================================
-- SCHRITT 5: View aktualisieren für Rückwärtskompatibilität
-- Die View liefert alle Felder wie vorher, kombiniert Produkt + Instanz
-- ============================================
DROP VIEW IF EXISTS v_materials_overview;

CREATE VIEW v_materials_overview AS
SELECT 
    m.id,
    COALESCE(p.name, m.name) AS name,
    COALESCE(p.description, m.description) AS description,
    COALESCE(p.size, m.size) AS size,
    m.unit,
    m.min_stock,
    m.current_stock,
    m.expiry_date,
    m.lot_number,
    COALESCE(p.gtin, m.article_number) AS article_number,
    COALESCE(p.cost, m.cost) AS cost,
    m.location_in_cabinet,
    m.shipping_container_code,
    COALESCE(p.notes, m.notes) AS notes,
    m.active,
    m.is_consignment,
    COALESCE(p.shape_id, m.shape_id) AS shape_id,
    s.name AS shape_name,
    COALESCE(p.shaft_length, m.shaft_length) AS shaft_length,
    COALESCE(p.device_length, m.device_length) AS device_length,
    COALESCE(p.device_diameter, m.device_diameter) AS device_diameter,
    COALESCE(p.french_size, m.french_size) AS french_size,
    COALESCE(p.guidewire_acceptance, m.guidewire_acceptance) AS guidewire_acceptance,
    m.category_id,
    c.name AS category_name,
    COALESCE(p.company_id, m.company_id) AS company_id,
    co.name AS company_name,
    m.cabinet_id,
    cab.name AS cabinet_name,
    cab.location AS cabinet_location,
    m.compartment_id,
    comp.name AS compartment_name,
    m.unit_id,
    u.name AS unit_name,
    m.product_id,
    p.gtin,
    m.created_at,
    m.updated_at,
    CASE
        WHEN m.current_stock <= m.min_stock THEN 'LOW'
        WHEN m.expiry_date IS NOT NULL AND m.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'EXPIRING'
        ELSE 'OK'
    END AS stock_status
FROM materials m
LEFT JOIN products p ON m.product_id = p.id
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON COALESCE(p.company_id, m.company_id) = co.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN compartments comp ON m.compartment_id = comp.id
LEFT JOIN units u ON m.unit_id = u.id
LEFT JOIN shapes s ON COALESCE(p.shape_id, m.shape_id) = s.id;

-- ============================================
-- SCHRITT 6: Produkte-View für einfachen Zugriff
-- ============================================
CREATE OR REPLACE VIEW v_products_overview AS
SELECT 
    p.id,
    p.gtin,
    p.name,
    p.description,
    p.size,
    p.company_id,
    co.name AS company_name,
    p.shape_id,
    s.name AS shape_name,
    p.shaft_length,
    p.device_length,
    p.device_diameter,
    p.french_size,
    p.guidewire_acceptance,
    p.cost,
    p.notes,
    p.created_at,
    p.updated_at,
    (SELECT COUNT(*) FROM materials m WHERE m.product_id = p.id AND m.active = TRUE) AS active_materials_count,
    (SELECT SUM(m.current_stock) FROM materials m WHERE m.product_id = p.id AND m.active = TRUE) AS total_stock
FROM products p
LEFT JOIN companies co ON p.company_id = co.id
LEFT JOIN shapes s ON p.shape_id = s.id;

-- ============================================
-- Fertig! Die Struktur ist jetzt normalisiert.
-- 
-- Stammdaten (in products): name, description, size, company, shape, 
--                           device properties, cost, notes
-- 
-- Instanz-Daten (in materials): lot_number, expiry_date, cabinet, compartment,
--                               category, is_consignment, unit, stock, etc.
-- ============================================
