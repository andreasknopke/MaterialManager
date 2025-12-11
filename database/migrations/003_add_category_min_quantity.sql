-- Migration: Add min_quantity to categories
-- Datum: 2025-12-11
-- Beschreibung: Fügt Mindestmenge auf Kategorieebene hinzu
-- Grund: Mindestmengen sollen sich auf die Gesamtmenge einer Kategorie beziehen,
--        nicht auf einzelne Materialien (z.B. "mindestens 3 Pushable Coils 2mm gesamt")

-- Prüfen ob Spalte bereits existiert
SET @dbname = DATABASE();
SET @tablename = 'categories';
SET @columnname = 'min_quantity';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT ''Column already exists'' AS message;',
  'ALTER TABLE categories ADD COLUMN min_quantity INT DEFAULT 0 COMMENT ''Mindestmenge für die gesamte Kategorie'';'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Prüfen ob Spalte department_id bereits existiert (aus vorherigen Migrationen)
SET @columnname = 'department_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT ''Column already exists'' AS message;',
  'ALTER TABLE categories ADD COLUMN department_id INT NULL COMMENT ''Department für Zugriffskontrolle'';'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Prüfen ob Spalte created_by bereits existiert
SET @columnname = 'created_by';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT ''Column already exists'' AS message;',
  'ALTER TABLE categories ADD COLUMN created_by INT NULL COMMENT ''User der die Kategorie angelegt hat'';'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Index für min_quantity hinzufügen falls nicht vorhanden
SET @indexname = 'idx_min_quantity';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = @indexname)
  ) > 0,
  'SELECT ''Index already exists'' AS message;',
  'CREATE INDEX idx_min_quantity ON categories(min_quantity);'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
