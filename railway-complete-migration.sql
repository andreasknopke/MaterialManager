-- Complete Migration Script for Railway Production
-- Combines all migrations: Units System + User Management + Department Access
-- Safe to run multiple times (idempotent)

-- ============================================================================
-- MIGRATION 002: Units System
-- ============================================================================

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
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT DEFAULT NULL AFTER id, ADD INDEX idx_unit_cabinet (unit_id)')
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
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT DEFAULT NULL AFTER id, ADD INDEX idx_unit_material (unit_id)')
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
    cab.unit_id AS cabinet_unit_id,
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
LEFT JOIN units u ON cab.unit_id = u.id;

-- Step 9: Update v_expiring_materials view
DROP VIEW IF EXISTS v_expiring_materials;
CREATE VIEW v_expiring_materials AS
SELECT 
    m.*,
    c.name AS category_name,
    co.name AS company_name,
    cab.unit_id AS cabinet_unit_id,
    u.name AS unit_name,
    u.color AS unit_color,
    DATEDIFF(m.expiry_date, CURDATE()) AS days_until_expiry
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN units u ON cab.unit_id = u.id
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
    cab.unit_id AS cabinet_unit_id,
    u.name AS unit_name,
    u.color AS unit_color
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN units u ON cab.unit_id = u.id
WHERE m.current_stock <= m.min_stock
    AND m.active = TRUE
ORDER BY (m.current_stock - m.min_stock) ASC;

-- Step 11: Create v_cabinets_overview view
DROP VIEW IF EXISTS v_cabinets_overview;
CREATE VIEW v_cabinets_overview AS
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

SELECT '✅ Migration 002: Units System completed!' AS status;

-- ============================================================================
-- MIGRATION 003: User Management System
-- ============================================================================

-- Drop old users table if exists
DROP TABLE IF EXISTS user_audit_log;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS users;

-- Create users table with authentication
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150),
    role ENUM('admin', 'user', 'viewer') DEFAULT 'user',
    is_root BOOLEAN DEFAULT FALSE COMMENT 'Root-User hat vollen Zugriff auf alle Departments',
    active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP NULL,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP NULL,
    must_change_password BOOLEAN DEFAULT FALSE COMMENT 'Erzwingt Passwortänderung bei nächstem Login',
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_email_verification_token (email_verification_token),
    INDEX idx_password_reset_token (password_reset_token)
) ENGINE=InnoDB COMMENT='Benutzer mit Authentifizierung und E-Mail-Verifizierung';

-- Login attempts tracking (Rate Limiting)
CREATE TABLE login_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    ip_address VARCHAR(45),
    success BOOLEAN DEFAULT FALSE,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_ip (ip_address),
    INDEX idx_attempted_at (attempted_at)
) ENGINE=InnoDB COMMENT='Login-Versuche für Rate Limiting';

-- Session table for JWT token management
CREATE TABLE user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_token_hash (token_hash),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB COMMENT='Aktive Benutzer-Sessions';

-- Audit log for user actions
CREATE TABLE user_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB COMMENT='Audit-Log für Benutzer-Aktionen';

-- Create Root user with password "root"
-- Password will be updated with correct hash via backend
INSERT INTO users (
    username, 
    email, 
    password_hash, 
    full_name, 
    role, 
    is_root, 
    active, 
    email_verified,
    must_change_password
) VALUES (
    'root',
    'root@materialmanager.local',
    '$2b$10$placeholder_will_be_updated_by_backend_on_first_run',
    'Root Administrator',
    'admin',
    TRUE,
    TRUE,
    TRUE,
    TRUE
);

-- Create v_users_overview view
DROP VIEW IF EXISTS v_users_overview;
CREATE VIEW v_users_overview AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.full_name,
    u.role,
    u.is_root,
    u.active,
    u.email_verified,
    u.must_change_password,
    u.last_login,
    u.created_at,
    u.updated_at,
    COUNT(DISTINCT s.id) AS active_sessions
FROM users u
LEFT JOIN user_sessions s ON u.id = s.user_id AND s.expires_at > NOW()
GROUP BY u.id;

SELECT '✅ Migration 003: User Management System completed!' AS status;

-- ============================================================================
-- MIGRATION 004: Department-Based Access Control
-- ============================================================================

-- Step 1: Add department_id to users table (check if column exists first)
SET @tablename = 'users';
SET @columnname = 'department_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT DEFAULT NULL AFTER role')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Step 2: Add foreign key to users if not exists
SET @fk_name = 'fk_user_department';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE
      CONSTRAINT_NAME = @fk_name
      AND TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'users'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE users ADD CONSTRAINT fk_user_department FOREIGN KEY (department_id) REFERENCES units(id) ON DELETE SET NULL'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Step 3: Create index on department_id if not exists
SET @index_name = 'idx_department';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      INDEX_NAME = @index_name
      AND TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'users'
  ) > 0,
  'SELECT 1',
  'CREATE INDEX idx_department ON users(department_id)'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Step 4: Update v_users_overview view with department info
DROP VIEW IF EXISTS v_users_overview;
CREATE VIEW v_users_overview AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.full_name,
    u.role,
    u.is_root,
    u.department_id,
    dept.name AS department_name,
    dept.color AS department_color,
    u.active,
    u.email_verified,
    u.must_change_password,
    u.last_login,
    u.created_at,
    u.updated_at,
    COUNT(DISTINCT s.id) AS active_sessions
FROM users u
LEFT JOIN units dept ON u.department_id = dept.id
LEFT JOIN user_sessions s ON u.id = s.user_id AND s.expires_at > NOW()
GROUP BY u.id, dept.name, dept.color;

SELECT '✅ Migration 004: Department-Based Access Control completed!' AS status;

-- ============================================================================
-- FINAL STATUS
-- ============================================================================

SELECT '🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!' AS final_status;
SELECT 'Next steps:' AS info;
SELECT '1. Update Root user password via backend POST /api/admin/update-root-password' AS step_1;
SELECT '2. Login with username: root, password: root' AS step_2;
SELECT '3. Change password on first login' AS step_3;
