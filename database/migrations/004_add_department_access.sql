-- Migration 004: Department-basierte Zugriffskontrolle
-- Erweitert das User Management um Department-Zuordnungen

-- Step 1: Add department_id to users table
ALTER TABLE users 
ADD COLUMN department_id INT DEFAULT NULL AFTER role,
ADD INDEX idx_department (department_id),
ADD CONSTRAINT fk_user_department 
  FOREIGN KEY (department_id) REFERENCES units(id) ON DELETE SET NULL;

-- Step 2: Update user roles - Root bleibt wie ist, andere Admins werden zu Department Admins
-- Hinweis: Dies wird manuell erfolgen, da wir nicht automatisch Department-Zuweisungen vornehmen können

-- Step 3: Create view for department-filtered materials
CREATE OR REPLACE VIEW v_department_materials AS
SELECT 
    m.*,
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
    END AS stock_status
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN units u ON m.unit_id = u.id;

-- Step 4: Create view for department-filtered cabinets
CREATE OR REPLACE VIEW v_department_cabinets AS
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

-- Step 5: Update v_users_overview to include department info
CREATE OR REPLACE VIEW v_users_overview AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.full_name,
    u.role,
    u.department_id,
    dept.name AS department_name,
    dept.color AS department_color,
    u.is_root,
    u.active,
    u.email_verified,
    u.must_change_password,
    u.last_login,
    u.created_at,
    u.updated_at
FROM users u
LEFT JOIN units dept ON u.department_id = dept.id;

-- Step 6: Add comments for clarity
ALTER TABLE users 
  MODIFY COLUMN role ENUM('admin', 'user', 'viewer') DEFAULT 'user' 
  COMMENT 'admin = Department Admin (wenn department_id gesetzt) oder Root Admin (wenn is_root=true)';

-- Migration completed
SELECT '✅ Migration 004: Department-based Access Control completed!' AS status;
