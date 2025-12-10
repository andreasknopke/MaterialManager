import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

const router = Router();

// GET alle Materialien mit erweiterten Informationen
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, cabinet, company, search, lowStock, expiring } = req.query;
    
    let query = 'SELECT * FROM v_materials_overview WHERE active = TRUE';
    const params: any[] = [];
    
    if (category) {
      query += ' AND category_name = ?';
      params.push(category);
    }
    
    if (cabinet) {
      query += ' AND cabinet_name = ?';
      params.push(cabinet);
    }
    
    if (company) {
      query += ' AND company_name = ?';
      params.push(company);
    }
    
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ? OR article_number LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }
    
    if (lowStock === 'true') {
      query += ' AND stock_status = "LOW"';
    }
    
    if (expiring === 'true') {
      query += ' AND stock_status = "EXPIRING"';
    }
    
    query += ' ORDER BY name';
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Materialien:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Material nach ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [materialRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM v_materials_overview WHERE id = ?',
      [req.params.id]
    );
    
    if (materialRows.length === 0) {
      return res.status(404).json({ error: 'Material nicht gefunden' });
    }
    
    // Benutzerdefinierte Felder abrufen
    const [customFields] = await pool.query<RowDataPacket[]>(
      `SELECT mcf.*, fc.field_name, fc.field_label, fc.field_type 
       FROM material_custom_fields mcf
       JOIN field_configurations fc ON mcf.field_config_id = fc.id
       WHERE mcf.material_id = ?`,
      [req.params.id]
    );
    
    // Barcodes abrufen
    const [barcodes] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM barcodes WHERE material_id = ?',
      [req.params.id]
    );
    
    res.json({
      ...materialRows[0],
      custom_fields: customFields,
      barcodes: barcodes
    });
  } catch (error) {
    console.error('Fehler beim Abrufen des Materials:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Transaktionshistorie eines Materials
router.get('/:id/transactions', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM material_transactions 
       WHERE material_id = ? 
       ORDER BY transaction_date DESC 
       LIMIT 100`,
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Transaktionen:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST neues Material
router.post('/', async (req: Request, res: Response) => {
  const {
    category_id, company_id, cabinet_id, name, description,
    size, unit, min_stock, current_stock, expiry_date,
    lot_number, article_number, location_in_cabinet, shipping_container_code, notes,
    custom_fields, barcodes
  } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Material einfügen
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO materials 
       (category_id, company_id, cabinet_id, name, description, size, unit,
        min_stock, current_stock, expiry_date, lot_number, article_number,
        location_in_cabinet, shipping_container_code, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category_id, company_id, cabinet_id, name, description, size, unit,
        min_stock || 0, current_stock || 0, expiry_date, lot_number,
        article_number, location_in_cabinet, shipping_container_code, notes
      ]
    );
    
    const materialId = result.insertId;
    
    // Benutzerdefinierte Felder einfügen
    if (custom_fields && Array.isArray(custom_fields)) {
      for (const field of custom_fields) {
        await connection.query(
          'INSERT INTO material_custom_fields (material_id, field_config_id, field_value) VALUES (?, ?, ?)',
          [materialId, field.field_config_id, field.field_value]
        );
      }
    }
    
    // Barcodes einfügen
    if (barcodes && Array.isArray(barcodes)) {
      for (const barcode of barcodes) {
        await connection.query(
          'INSERT INTO barcodes (material_id, barcode, barcode_type, is_primary) VALUES (?, ?, ?, ?)',
          [materialId, barcode.barcode, barcode.barcode_type || 'CODE128', barcode.is_primary || false]
        );
      }
    }
    
    // Initiale Transaktion für den Anfangsbestand
    if (current_stock > 0) {
      await connection.query(
        `INSERT INTO material_transactions 
         (material_id, transaction_type, quantity, previous_stock, new_stock, notes)
         VALUES (?, 'in', ?, 0, ?, 'Anfangsbestand')`,
        [materialId, current_stock, current_stock]
      );
    }
    
    await connection.commit();
    
    res.status(201).json({
      id: materialId,
      message: 'Material erfolgreich erstellt'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Erstellen des Materials:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  } finally {
    connection.release();
  }
});

// PUT Material aktualisieren
router.put('/:id', async (req: Request, res: Response) => {
  const {
    category_id, company_id, cabinet_id, name, description,
    size, unit, min_stock, expiry_date,
    lot_number, article_number, location_in_cabinet, shipping_container_code, notes, active
  } = req.body;
  
  try {
    // active sollte standardmäßig true sein, wenn nicht explizit gesetzt
    const isActive = active !== undefined ? active : true;
    
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE materials 
       SET category_id = ?, company_id = ?, cabinet_id = ?, name = ?,
           description = ?, size = ?, unit = ?, min_stock = ?,
           expiry_date = ?, lot_number = ?,
           article_number = ?, location_in_cabinet = ?, shipping_container_code = ?, notes = ?, active = ?
       WHERE id = ?`,
      [
        category_id, company_id, cabinet_id, name, description, size, unit,
        min_stock, expiry_date, lot_number, article_number,
        location_in_cabinet, shipping_container_code, notes, isActive, req.params.id
      ]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Material nicht gefunden' });
    }
    
    res.json({ message: 'Material erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Materials:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST Material-Eingang
router.post('/:id/stock-in', async (req: Request, res: Response) => {
  const { quantity, reference_number, notes, user_name } = req.body;
  
  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Ungültige Menge' });
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Aktuellen Bestand abrufen
    const [materials] = await connection.query<RowDataPacket[]>(
      'SELECT current_stock FROM materials WHERE id = ?',
      [req.params.id]
    );
    
    if (materials.length === 0) {
      throw new Error('Material nicht gefunden');
    }
    
    const previousStock = materials[0].current_stock;
    const newStock = previousStock + quantity;
    
    // Bestand aktualisieren
    await connection.query(
      'UPDATE materials SET current_stock = ? WHERE id = ?',
      [newStock, req.params.id]
    );
    
    // Transaktion aufzeichnen
    await connection.query(
      `INSERT INTO material_transactions 
       (material_id, transaction_type, quantity, previous_stock, new_stock, reference_number, notes, user_name)
       VALUES (?, 'in', ?, ?, ?, ?, ?, ?)`,
      [req.params.id, quantity, previousStock, newStock, reference_number, notes, user_name]
    );
    
    await connection.commit();
    
    res.json({
      message: 'Eingang erfolgreich gebucht',
      previous_stock: previousStock,
      new_stock: newStock
    });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Materialeingang:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  } finally {
    connection.release();
  }
});

// POST Material-Ausgang
router.post('/:id/stock-out', async (req: Request, res: Response) => {
  const { quantity, reference_number, notes, user_name } = req.body;
  
  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Ungültige Menge' });
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const [materials] = await connection.query<RowDataPacket[]>(
      'SELECT current_stock FROM materials WHERE id = ?',
      [req.params.id]
    );
    
    if (materials.length === 0) {
      throw new Error('Material nicht gefunden');
    }
    
    const previousStock = materials[0].current_stock;
    const newStock = previousStock - quantity;
    
    if (newStock < 0) {
      throw new Error('Nicht genügend Bestand verfügbar');
    }
    
    await connection.query(
      'UPDATE materials SET current_stock = ? WHERE id = ?',
      [newStock, req.params.id]
    );
    
    await connection.query(
      `INSERT INTO material_transactions 
       (material_id, transaction_type, quantity, previous_stock, new_stock, reference_number, notes, user_name)
       VALUES (?, 'out', ?, ?, ?, ?, ?, ?)`,
      [req.params.id, quantity, previousStock, newStock, reference_number, notes, user_name]
    );
    
    await connection.commit();
    
    res.json({
      message: 'Ausgang erfolgreich gebucht',
      previous_stock: previousStock,
      new_stock: newStock
    });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Materialausgang:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Datenbankfehler' });
  } finally {
    connection.release();
  }
});

// DELETE Material (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE materials SET active = FALSE WHERE id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Material nicht gefunden' });
    }
    
    res.json({ message: 'Material erfolgreich deaktiviert' });
  } catch (error) {
    console.error('Fehler beim Löschen des Materials:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET ablaufende Materialien
router.get('/reports/expiring', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM v_expiring_materials'
    );
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen ablaufender Materialien:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Materialien mit niedrigem Bestand
router.get('/reports/low-stock', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM v_low_stock_materials'
    );
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Materialien mit niedrigem Bestand:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
