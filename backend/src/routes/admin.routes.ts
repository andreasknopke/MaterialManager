import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();

// POST /api/admin/reset-database - Löscht alle Daten aus der Datenbank
router.post('/reset-database', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Reihenfolge wichtig wegen Foreign Key Constraints
    // Zuerst abhängige Tabellen, dann Haupttabellen
    
    console.log('Starte Datenbank-Reset...');
    
    // Abhängige Tabellen zuerst
    await connection.query('DELETE FROM material_transactions');
    console.log('✓ material_transactions gelöscht');
    
    await connection.query('DELETE FROM barcodes');
    console.log('✓ barcodes gelöscht');
    
    await connection.query('DELETE FROM material_custom_fields');
    console.log('✓ material_custom_fields gelöscht');
    
    // Haupttabellen
    await connection.query('DELETE FROM materials');
    console.log('✓ materials gelöscht');
    
    await connection.query('DELETE FROM cabinets');
    console.log('✓ cabinets gelöscht');
    
    await connection.query('DELETE FROM companies');
    console.log('✓ companies gelöscht');
    
    await connection.query('DELETE FROM categories');
    console.log('✓ categories gelöscht');
    
    await connection.query('DELETE FROM field_configurations');
    console.log('✓ field_configurations gelöscht');
    
    // Optional: users Tabelle (falls vorhanden)
    try {
      await connection.query('DELETE FROM users');
      console.log('✓ users gelöscht');
    } catch (err) {
      // Tabelle existiert möglicherweise nicht
      console.log('ℹ users Tabelle nicht vorhanden oder bereits leer');
    }
    
    // AUTO_INCREMENT zurücksetzen
    await connection.query('ALTER TABLE materials AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE categories AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE companies AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE cabinets AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE barcodes AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE material_transactions AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE material_custom_fields AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE field_configurations AUTO_INCREMENT = 1');
    console.log('✓ AUTO_INCREMENT zurückgesetzt');

    await connection.commit();
    
    console.log('✅ Datenbank erfolgreich geleert!');
    res.json({ 
      success: true, 
      message: 'Datenbank wurde erfolgreich geleert',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Fehler beim Zurücksetzen der Datenbank:', error);
    res.status(500).json({ 
      error: 'Fehler beim Zurücksetzen der Datenbank',
      details: error instanceof Error ? error.message : 'Unbekannter Fehler'
    });
  } finally {
    connection.release();
  }
});

// POST /api/admin/run-migration - Führt die Units-Migration aus
router.post('/run-migration', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔄 Starting migration 002_add_units_system...');
    
    // Step 1: Create units table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS units (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        color VARCHAR(7) DEFAULT '#1976d2',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_active (active)
      ) ENGINE=InnoDB
    `);
    console.log('✓ units table created');

    // Step 2: Check and add unit_id to cabinets
    const [cabinetColumns]: any = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cabinets' AND COLUMN_NAME = 'unit_id'
    `);
    
    if (cabinetColumns.length === 0) {
      await connection.query('ALTER TABLE cabinets ADD COLUMN unit_id INT DEFAULT NULL AFTER id');
      await connection.query('ALTER TABLE cabinets ADD INDEX idx_unit (unit_id)');
      await connection.query('ALTER TABLE cabinets ADD CONSTRAINT fk_cabinet_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL');
      console.log('✓ unit_id added to cabinets');
    } else {
      console.log('✓ unit_id already exists in cabinets');
    }

    // Step 3: Check and add unit_id to materials
    const [materialColumns]: any = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materials' AND COLUMN_NAME = 'unit_id'
    `);
    
    if (materialColumns.length === 0) {
      await connection.query('ALTER TABLE materials ADD COLUMN unit_id INT DEFAULT NULL AFTER id');
      await connection.query('ALTER TABLE materials ADD INDEX idx_unit (unit_id)');
      await connection.query('ALTER TABLE materials ADD CONSTRAINT fk_material_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL');
      console.log('✓ unit_id added to materials');
    } else {
      console.log('✓ unit_id already exists in materials');
    }

    // Step 4: Insert initial units
    await connection.query(`
      INSERT IGNORE INTO units (name, description, color, active) VALUES
        ('Radiologie', 'Radiologische Abteilung', '#2196F3', TRUE),
        ('Angiologie', 'Angiologische Abteilung', '#4CAF50', TRUE),
        ('Gefäßchirurgie', 'Gefäßchirurgische Abteilung', '#FF9800', TRUE),
        ('Kardiologie', 'Kardiologische Abteilung', '#F44336', TRUE)
    `);
    console.log('✓ Initial units created');

    // Step 5: Create material_transfers table
    await connection.query(`
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
      ) ENGINE=InnoDB
    `);
    console.log('✓ material_transfers table created');

    // Step 6: Update views
    await connection.query('DROP VIEW IF EXISTS v_materials_overview');
    await connection.query(`
      CREATE VIEW v_materials_overview AS
      SELECT 
        m.id, m.name, m.description, m.size, m.unit, m.current_stock, m.min_stock,
        m.expiry_date, m.lot_number, m.article_number, m.location_in_cabinet, m.active,
        c.name AS category_name, co.name AS company_name,
        cab.name AS cabinet_name, cab.location AS cabinet_location,
        u.name AS unit_name, u.color AS unit_color,
        CASE 
          WHEN m.current_stock <= m.min_stock THEN 'LOW'
          WHEN m.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'EXPIRING'
          ELSE 'OK'
        END AS stock_status,
        m.created_at, m.updated_at
      FROM materials m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN companies co ON m.company_id = co.id
      LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
      LEFT JOIN units u ON m.unit_id = u.id
    `);
    console.log('✓ v_materials_overview updated');

    await connection.query('DROP VIEW IF EXISTS v_expiring_materials');
    await connection.query(`
      CREATE VIEW v_expiring_materials AS
      SELECT m.*, c.name AS category_name, co.name AS company_name,
        u.name AS unit_name, u.color AS unit_color,
        DATEDIFF(m.expiry_date, CURDATE()) AS days_until_expiry
      FROM materials m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN companies co ON m.company_id = co.id
      LEFT JOIN units u ON m.unit_id = u.id
      WHERE m.expiry_date IS NOT NULL 
        AND m.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
        AND m.active = TRUE
      ORDER BY m.expiry_date ASC
    `);
    console.log('✓ v_expiring_materials updated');

    await connection.query('DROP VIEW IF EXISTS v_low_stock_materials');
    await connection.query(`
      CREATE VIEW v_low_stock_materials AS
      SELECT m.*, c.name AS category_name, co.name AS company_name,
        cab.name AS cabinet_name, u.name AS unit_name, u.color AS unit_color
      FROM materials m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN companies co ON m.company_id = co.id
      LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
      LEFT JOIN units u ON m.unit_id = u.id
      WHERE m.current_stock <= m.min_stock AND m.active = TRUE
      ORDER BY (m.current_stock - m.min_stock) ASC
    `);
    console.log('✓ v_low_stock_materials updated');

    await connection.query(`
      CREATE OR REPLACE VIEW v_cabinets_overview AS
      SELECT cab.*, u.name AS unit_name, u.color AS unit_color,
        COUNT(m.id) AS material_count, SUM(m.current_stock) AS total_items
      FROM cabinets cab
      LEFT JOIN units u ON cab.unit_id = u.id
      LEFT JOIN materials m ON m.cabinet_id = cab.id AND m.active = TRUE
      GROUP BY cab.id, u.name, u.color
    `);
    console.log('✓ v_cabinets_overview created');

    console.log('✅ Migration 002_add_units_system completed successfully!');
    
    res.json({ 
      success: true, 
      message: 'Migration completed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({ 
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    connection.release();
  }
});

// POST /api/admin/run-user-migration - Führt die User-Management-Migration aus
router.post('/run-user-migration', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔄 Starting migration 003_add_user_management...');
    
    // Step 1: Create users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100),
        role ENUM('admin', 'user', 'viewer') DEFAULT 'user',
        is_root BOOLEAN DEFAULT FALSE,
        active BOOLEAN DEFAULT TRUE,
        email_verified BOOLEAN DEFAULT FALSE,
        email_verification_token VARCHAR(64),
        email_verification_expires TIMESTAMP NULL,
        password_reset_token VARCHAR(64),
        password_reset_expires TIMESTAMP NULL,
        must_change_password BOOLEAN DEFAULT FALSE,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_email (email),
        INDEX idx_email_verification_token (email_verification_token),
        INDEX idx_password_reset_token (password_reset_token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ users table created');

    // Step 2: Create user_sessions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(500) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_token (token(255)),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ user_sessions table created');

    // Step 3: Create login_attempts table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        ip_address VARCHAR(45),
        success BOOLEAN DEFAULT FALSE,
        attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_ip_address (ip_address),
        INDEX idx_attempt_time (attempt_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ login_attempts table created');

    // Step 4: Create user_audit_log table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        action VARCHAR(50) NOT NULL,
        details TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ user_audit_log table created');

    // Step 5: Create views
    await connection.query(`
      CREATE OR REPLACE VIEW v_users_overview AS
      SELECT 
        id,
        username,
        email,
        full_name,
        role,
        is_root,
        active,
        email_verified,
        must_change_password,
        last_login,
        created_at,
        updated_at
      FROM users
    `);
    console.log('✓ v_users_overview view created');

    await connection.query(`
      CREATE OR REPLACE VIEW v_active_sessions AS
      SELECT 
        s.id,
        s.user_id,
        u.username,
        u.email,
        s.ip_address,
        s.user_agent,
        s.expires_at,
        s.created_at
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.expires_at > NOW()
    `);
    console.log('✓ v_active_sessions view created');

    // Step 6: Insert Root user (only if not exists)
    const [existingRoot] = await connection.query(
      'SELECT id FROM users WHERE username = ?',
      ['root']
    ) as any[];

    if (existingRoot.length === 0) {
      // Password: 'root' hashed with bcrypt
      const bcrypt = require('bcrypt');
      const rootPasswordHash = await bcrypt.hash('root', 10);
      
      await connection.query(
        `INSERT INTO users (username, email, password_hash, full_name, role, is_root, email_verified, must_change_password)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['root', 'root@materialmanager.local', rootPasswordHash, 'Root Administrator', 'admin', true, true, true]
      );
      console.log('✓ Root user created (username: root, password: root)');
    } else {
      console.log('ℹ Root user already exists, skipping creation');
    }

    console.log('✅ Migration 003_add_user_management completed!');
    
    res.json({ 
      success: true, 
      message: 'User Management Migration completed successfully. Root user: root / root',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ User Migration failed:', error);
    res.status(500).json({ 
      error: 'User Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    connection.release();
  }
});

// POST /api/admin/run-department-migration - Führt die Department-Migration aus
router.post('/run-department-migration', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔄 Starting migration 004_add_department_access...');
    
    // Step 1: Add department_id to users table
    await connection.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS department_id INT DEFAULT NULL AFTER role
    `);
    console.log('✓ department_id column added to users');

    await connection.query(`
      ALTER TABLE users 
      ADD INDEX IF NOT EXISTS idx_department (department_id)
    `);
    console.log('✓ department_id index added');

    // Step 2: Add foreign key (nur wenn noch nicht vorhanden)
    const [fkCheck] = await connection.query(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE CONSTRAINT_NAME = 'fk_user_department'
      AND TABLE_SCHEMA = DATABASE()
    `) as any[];

    if (fkCheck[0].count === 0) {
      await connection.query(`
        ALTER TABLE users 
        ADD CONSTRAINT fk_user_department 
        FOREIGN KEY (department_id) REFERENCES units(id) ON DELETE SET NULL
      `);
      console.log('✓ Foreign key fk_user_department added');
    } else {
      console.log('ℹ Foreign key fk_user_department already exists');
    }

    // Step 3: Update v_users_overview
    await connection.query(`
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
      LEFT JOIN units dept ON u.department_id = dept.id
    `);
    console.log('✓ v_users_overview updated with department info');

    console.log('✅ Migration 004_add_department_access completed!');
    
    res.json({ 
      success: true, 
      message: 'Department Access Migration completed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Department Migration failed:', error);
    res.status(500).json({ 
      error: 'Department Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    connection.release();
  }
});

// POST /api/admin/update-root-password - Aktualisiert Root-User Passwort (für Railway Setup)
router.post('/update-root-password', async (req: Request, res: Response) => {
  const bcrypt = require('bcrypt');
  
  try {
    // Generiere korrekten bcrypt Hash für Passwort "root"
    const passwordHash = await bcrypt.hash('root', 10);
    
    // Update Root-User mit korrektem Hash
    const [result] = await pool.query(
      'UPDATE users SET password_hash = ? WHERE username = ? AND is_root = TRUE',
      [passwordHash, 'root']
    );
    
    console.log('✅ Root user password updated successfully');
    
    res.json({ 
      success: true, 
      message: 'Root user password updated. You can now login with username: root, password: root',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Failed to update root password:', error);
    res.status(500).json({ 
      error: 'Failed to update root password',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/admin/run-category-migration - Führt Migration für Category min_quantity aus
router.post('/run-category-migration', async (req: Request, res: Response) => {
  try {
    console.log('Starting category min_quantity migration...');
    
    // Prüfen ob Spalte bereits existiert
    const [columns] = await pool.query<any[]>(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'categories' 
        AND COLUMN_NAME = 'min_quantity'
    `);
    
    if (columns.length > 0) {
      console.log('✓ min_quantity column already exists');
      return res.json({ 
        message: 'Migration already completed',
        status: 'already_exists'
      });
    }
    
    // Spalte hinzufügen
    await pool.query(`
      ALTER TABLE categories 
      ADD COLUMN min_quantity INT DEFAULT 0 COMMENT 'Mindestmenge für die gesamte Kategorie'
    `);
    console.log('✓ Added min_quantity column');
    
    // Index hinzufügen
    await pool.query(`
      CREATE INDEX idx_min_quantity ON categories(min_quantity)
    `);
    console.log('✓ Added index on min_quantity');
    
    res.json({ 
      message: 'Category migration completed successfully',
      status: 'success'
    });
    
  } catch (error) {
    console.error('❌ Category migration failed:', error);
    res.status(500).json({ 
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/admin/run-cabinet-department-migration
router.post('/run-cabinet-department-migration', async (req: Request, res: Response) => {
  try {
    console.log('Starting cabinet department_id migration...');
    
    // Prüfen ob Spalte bereits existiert
    const [cols] = await pool.query<any[]>(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'cabinets' 
        AND COLUMN_NAME = 'department_id'
    `);
    
    if (cols[0].count > 0) {
      console.log('ℹ department_id column already exists');
      return res.json({ 
        message: 'Migration already completed - department_id column exists',
        status: 'already_done'
      });
    }
    
    // Spalte hinzufügen
    await pool.query(`
      ALTER TABLE cabinets 
      ADD COLUMN department_id INT AFTER id
    `);
    console.log('✓ Added department_id column');
    
    // Foreign Key hinzufügen
    await pool.query(`
      ALTER TABLE cabinets
      ADD FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
    `);
    console.log('✓ Added foreign key constraint');
    
    // Bestehende Schränke den Departments zuordnen
    await pool.query(`
      UPDATE cabinets 
      SET department_id = CASE 
        WHEN location = 'Angiographie' THEN 1
        WHEN location = 'Katheterlabor' THEN 3
        ELSE 1
      END
      WHERE department_id IS NULL
    `);
    console.log('✓ Updated existing cabinets with department_id');
    
    // Index hinzufügen
    await pool.query(`
      CREATE INDEX idx_department ON cabinets(department_id)
    `);
    console.log('✓ Added index on department_id');
    
    res.json({ 
      message: 'Cabinet department migration completed successfully',
      status: 'success'
    });
    
  } catch (error) {
    console.error('❌ Cabinet department migration failed:', error);
    res.status(500).json({ 
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/admin/fix-cabinet-departments - Setzt department_id für alle Schränke auf Radiologie
router.post('/fix-cabinet-departments', async (req: Request, res: Response) => {
  try {
    console.log('Fixing cabinet department IDs...');
    
    // Alle Schränke ohne department_id auf Radiologie (ID 3) setzen
    const [result] = await pool.query<any>(
      'UPDATE cabinets SET department_id = 3 WHERE department_id IS NULL OR department_id = 0'
    );
    
    console.log('✓ Updated cabinets:', result.affectedRows);
    
    // Alle Schränke abrufen zur Bestätigung
    const [cabinets] = await pool.query<any[]>(
      'SELECT id, name, location, department_id FROM cabinets'
    );
    
    res.json({ 
      message: `${result.affectedRows} Schränke wurden Radiologie (ID 3) zugeordnet`,
      status: 'success',
      cabinets: cabinets
    });
    
  } catch (error) {
    console.error('❌ Failed to fix cabinet departments:', error);
    res.status(500).json({ 
      error: 'Fix failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/admin/debug-cabinets - Debug endpoint für Cabinet-Daten
router.get('/debug-cabinets', async (req: Request, res: Response) => {
  try {
    // Alle Schränke mit allen Spalten
    const [cabinets] = await pool.query<any[]>(
      'SELECT * FROM cabinets'
    );
    
    // Alle Departments
    const [departments] = await pool.query<any[]>(
      'SELECT * FROM departments'
    );
    
    // Join Query wie in cabinet.routes.ts
    const [joined] = await pool.query<any[]>(
      'SELECT c.*, d.name as department_name FROM cabinets c LEFT JOIN departments d ON c.department_id = d.id'
    );
    
    res.json({
      cabinets: cabinets,
      departments: departments,
      joined: joined,
      cabinetCount: cabinets.length,
      departmentCount: departments.length
    });
    
  } catch (error) {
    console.error('❌ Debug query failed:', error);
    res.status(500).json({ 
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
