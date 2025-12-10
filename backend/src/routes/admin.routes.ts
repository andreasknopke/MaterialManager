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

export default router;
