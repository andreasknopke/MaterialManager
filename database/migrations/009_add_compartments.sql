-- Migration 009: Fächer-System für Schränke
-- Ersetzt das Freitext-Feld location_in_cabinet durch eine strukturierte Fächer-Verwaltung

-- 1. Neue Tabelle für Fächer (Compartments)
CREATE TABLE IF NOT EXISTS compartments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cabinet_id INT NOT NULL,
    name VARCHAR(100) NOT NULL COMMENT 'z.B. "Fach 1", "Regal A", "Schublade 3"',
    description VARCHAR(255) NULL COMMENT 'Optionale Beschreibung',
    position INT DEFAULT 0 COMMENT 'Sortierreihenfolge',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cabinet_id) REFERENCES cabinets(id) ON DELETE CASCADE,
    UNIQUE KEY unique_compartment_name (cabinet_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Neue Spalte compartment_id zur materials-Tabelle hinzufügen
ALTER TABLE materials 
ADD COLUMN compartment_id INT NULL AFTER cabinet_id,
ADD CONSTRAINT fk_materials_compartment 
    FOREIGN KEY (compartment_id) REFERENCES compartments(id) ON DELETE SET NULL;

-- 3. Index für Performance
CREATE INDEX idx_compartments_cabinet ON compartments(cabinet_id);
CREATE INDEX idx_materials_compartment ON materials(compartment_id);

-- 4. Migriere existierende location_in_cabinet-Daten zu Fächern
-- Für jeden einzigartigen Wert in location_in_cabinet erstelle ein Fach
INSERT INTO compartments (cabinet_id, name, position)
SELECT DISTINCT 
    m.cabinet_id,
    m.location_in_cabinet,
    0
FROM materials m
WHERE m.location_in_cabinet IS NOT NULL 
    AND m.location_in_cabinet != ''
    AND m.cabinet_id IS NOT NULL
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 5. Verknüpfe Materialien mit den neu erstellten Fächern
UPDATE materials m
INNER JOIN compartments c ON m.cabinet_id = c.cabinet_id AND m.location_in_cabinet = c.name
SET m.compartment_id = c.id
WHERE m.location_in_cabinet IS NOT NULL 
    AND m.location_in_cabinet != ''
    AND m.cabinet_id IS NOT NULL;

-- 6. View v_materials_overview aktualisieren um Fach-Information einzuschließen
DROP VIEW IF EXISTS v_materials_overview;

CREATE VIEW v_materials_overview AS
SELECT 
  m.id,
  m.name,
  m.description,
  m.size,
  m.unit,
  m.min_stock,
  m.current_stock,
  m.expiry_date,
  m.lot_number,
  m.article_number,
  m.cost,
  m.location_in_cabinet,
  m.compartment_id,
  comp.name AS compartment_name,
  m.shipping_container_code,
  m.notes,
  m.active,
  m.created_at,
  m.updated_at,
  m.unit_id,
  c.id AS category_id,
  c.name AS category_name,
  c.min_quantity AS category_min_quantity,
  co.id AS company_id,
  co.name AS company_name,
  cab.id AS cabinet_id,
  cab.name AS cabinet_name,
  cab.location AS cabinet_location,
  u.id AS department_id,
  u.name AS unit_name,
  CASE 
    WHEN m.current_stock <= 0 THEN 'OUT'
    WHEN m.current_stock <= COALESCE(c.min_quantity, m.min_stock, 0) THEN 'LOW'
    WHEN m.expiry_date IS NOT NULL AND m.expiry_date <= DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY) THEN 'EXPIRING'
    ELSE 'OK'
  END AS stock_status
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN compartments comp ON m.compartment_id = comp.id
LEFT JOIN units u ON m.unit_id = u.id;

-- 7. Hinweis: location_in_cabinet bleibt vorerst erhalten für Abwärtskompatibilität
-- In einer späteren Migration kann es entfernt werden
