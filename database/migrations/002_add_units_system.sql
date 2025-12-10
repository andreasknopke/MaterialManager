-- Migration: Einheiten/Abteilungen-System hinzufügen
-- Ermöglicht die Verwaltung von mehreren medizinischen Einheiten mit eigenen Schränken und Materialien

USE material_manager;

-- Tabelle für Einheiten/Abteilungen
CREATE TABLE IF NOT EXISTS units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) DEFAULT '#1976d2' COMMENT 'Hex-Farbcode für UI',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_active (active)
) ENGINE=InnoDB COMMENT='Medizinische Einheiten/Abteilungen';

-- unit_id zu cabinets hinzufügen
ALTER TABLE cabinets 
ADD COLUMN unit_id INT DEFAULT NULL AFTER id,
ADD CONSTRAINT fk_cabinet_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL,
ADD INDEX idx_unit (unit_id);

-- unit_id zu materials hinzufügen (primäre Einheit, die das Material besitzt)
ALTER TABLE materials 
ADD COLUMN unit_id INT DEFAULT NULL AFTER id,
ADD CONSTRAINT fk_material_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL,
ADD INDEX idx_unit (unit_id);

-- Initiale Einheiten erstellen
INSERT INTO units (name, description, color, active) VALUES
    ('Radiologie', 'Radiologische Abteilung', '#2196F3', TRUE),
    ('Angiologie', 'Angiologische Abteilung', '#4CAF50', TRUE),
    ('Gefäßchirurgie', 'Gefäßchirurgische Abteilung', '#FF9800', TRUE),
    ('Kardiologie', 'Kardiologische Abteilung', '#F44336', TRUE);

-- View für Materialübersicht mit Einheiten erweitern
DROP VIEW IF EXISTS v_materials_overview;
CREATE VIEW v_materials_overview AS
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
    u.name AS unit_name,
    u.color AS unit_color,
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
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN units u ON m.unit_id = u.id;

-- View für ablaufende Materialien mit Einheiten
DROP VIEW IF EXISTS v_expiring_materials;
CREATE VIEW v_expiring_materials AS
SELECT 
    m.*,
    c.name AS category_name,
    co.name AS company_name,
    u.name AS unit_name,
    u.color AS unit_color,
    DATEDIFF(m.expiry_date, CURDATE()) AS days_until_expiry
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
LEFT JOIN units u ON m.unit_id = u.id
WHERE m.expiry_date IS NOT NULL 
    AND m.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
    AND m.active = TRUE
ORDER BY m.expiry_date ASC;

-- View für Materialien mit niedrigem Bestand mit Einheiten
DROP VIEW IF EXISTS v_low_stock_materials;
CREATE VIEW v_low_stock_materials AS
SELECT 
    m.*,
    c.name AS category_name,
    co.name AS company_name,
    cab.name AS cabinet_name,
    u.name AS unit_name,
    u.color AS unit_color
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN units u ON m.unit_id = u.id
WHERE m.current_stock <= m.min_stock
    AND m.active = TRUE
ORDER BY (m.current_stock - m.min_stock) ASC;

-- Tabelle für Materialtransfers zwischen Einheiten
CREATE TABLE IF NOT EXISTS material_transfers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    from_unit_id INT,
    to_unit_id INT NOT NULL,
    quantity INT NOT NULL,
    transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    user_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (from_unit_id) REFERENCES units(id) ON DELETE SET NULL,
    FOREIGN KEY (to_unit_id) REFERENCES units(id) ON DELETE CASCADE,
    INDEX idx_material (material_id),
    INDEX idx_from_unit (from_unit_id),
    INDEX idx_to_unit (to_unit_id),
    INDEX idx_date (transfer_date)
) ENGINE=InnoDB COMMENT='Material-Transfers zwischen Einheiten';

-- View für Schränke mit Einheiten
CREATE OR REPLACE VIEW v_cabinets_overview AS
SELECT 
    cab.*,
    u.name AS unit_name,
    u.color AS unit_color,
    COUNT(m.id) AS material_count,
    SUM(m.current_stock) AS total_items
FROM cabinets cab
LEFT JOIN units u ON cab.unit_id = u.id
LEFT JOIN materials m ON m.cabinet_id = cab.id AND m.active = TRUE
GROUP BY cab.id, u.name, u.color;
