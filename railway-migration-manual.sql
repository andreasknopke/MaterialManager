-- Manual Migration Script for Railway
-- Run this directly in the Railway MySQL console if needed
-- This applies migration 002_add_units_system.sql

-- Step 1: Create units table
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

-- Step 2: Add unit_id to cabinets (check if column exists first)
SET @dbname = DATABASE();
SET @tablename = 'cabinets';
SET @columnname = 'unit_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT DEFAULT NULL AFTER id, ADD INDEX idx_unit (unit_id)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Step 3: Add foreign key to cabinets if not exists
SET @fk_name = 'fk_cabinet_unit';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE
      CONSTRAINT_NAME = @fk_name
      AND TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'cabinets'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE cabinets ADD CONSTRAINT fk_cabinet_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Step 4: Add unit_id to materials (check if column exists first)
SET @tablename = 'materials';
SET @columnname = 'unit_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT DEFAULT NULL AFTER id, ADD INDEX idx_unit (unit_id)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Step 5: Add foreign key to materials if not exists
SET @fk_name = 'fk_material_unit';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE
      CONSTRAINT_NAME = @fk_name
      AND TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'materials'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE materials ADD CONSTRAINT fk_material_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Step 6: Insert initial units (only if table is empty)
INSERT IGNORE INTO units (name, description, color, active) VALUES
    ('Radiologie', 'Radiologische Abteilung', '#2196F3', TRUE),
    ('Angiologie', 'Angiologische Abteilung', '#4CAF50', TRUE),
    ('Gefäßchirurgie', 'Gefäßchirurgische Abteilung', '#FF9800', TRUE),
    ('Kardiologie', 'Kardiologische Abteilung', '#F44336', TRUE);

-- Step 7: Create material_transfers table
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

-- Step 8: Update v_materials_overview view
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

-- Step 9: Update v_expiring_materials view
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

-- Step 10: Update v_low_stock_materials view
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

-- Step 11: Create v_cabinets_overview view
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

-- Migration completed
SELECT '✅ Migration 002_add_units_system completed successfully!' AS status;
