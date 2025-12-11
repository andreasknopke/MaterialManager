-- Migration: Add department_id to cabinets table
-- Date: 2025-12-11
-- Purpose: Schränke müssen einem Department zugeordnet sein, damit Department Admins ihre eigenen Schränke verwalten können

USE material_manager;

-- Prüfen ob Spalte bereits existiert
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'material_manager' 
  AND TABLE_NAME = 'cabinets' 
  AND COLUMN_NAME = 'department_id';

-- Spalte hinzufügen wenn sie nicht existiert
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE cabinets ADD COLUMN department_id INT AFTER id, ADD FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT',
  'SELECT "Column department_id already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Bestehende Schränke den Departments zuordnen basierend auf dem Namen
-- "Schrank 1" -> Kardiologie (ID 1)
-- Andere -> Radiologie (ID 3) als Fallback
UPDATE cabinets 
SET department_id = CASE 
  WHEN location = 'Angiographie' THEN 1
  WHEN location = 'Katheterlabor' THEN 3
  ELSE 1  -- Default: Kardiologie
END
WHERE department_id IS NULL;

-- Index für bessere Performance
SET @idx_exists = 0;
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'material_manager'
  AND TABLE_NAME = 'cabinets'
  AND INDEX_NAME = 'idx_department';

SET @sql_idx = IF(@idx_exists = 0,
  'CREATE INDEX idx_department ON cabinets(department_id)',
  'SELECT "Index idx_department already exists" AS message'
);

PREPARE stmt FROM @sql_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration 004 completed successfully' AS status;
