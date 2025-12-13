import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { authenticate } from '../middleware/auth';
import { getDepartmentFilter } from '../utils/departmentFilter';

const router = Router();

// Alle Routes benötigen Authentifizierung
router.use(authenticate);

// POST erweiterte Suche für Materialien
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { lot_number, expiry_months, query: searchQuery, category_id, is_consignment } = req.body;
    
    let sql = 'SELECT * FROM v_materials_overview WHERE active = TRUE';
    const params: any[] = [];
    
    // Department-Filter hinzufügen
    const departmentFilter = getDepartmentFilter(req, '');
    if (departmentFilter.whereClause) {
      sql += ` AND ${departmentFilter.whereClause}`;
      params.push(...departmentFilter.params);
    }
    
    // Chargen-Suche (LOT)
    if (lot_number) {
      sql += ' AND lot_number LIKE ?';
      params.push(`%${lot_number}%`);
    }
    
    // Verfallsdatum-Suche
    if (expiry_months !== undefined) {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + expiry_months);
      sql += ' AND expiry_date IS NOT NULL AND expiry_date <= ?';
      params.push(futureDate.toISOString().split('T')[0]);
    }
    
    // Freitext-Suche
    if (searchQuery) {
      sql += ' AND (name LIKE ? OR description LIKE ? OR article_number LIKE ? OR notes LIKE ?)';
      const searchParam = `%${searchQuery}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    // Kategorie-Suche
    if (category_id) {
      sql += ' AND category_id = ?';
      params.push(category_id);
    }
    
    // Consignationsware-Filter
    if (is_consignment !== undefined) {
      sql += ' AND is_consignment = ?';
      params.push(is_consignment ? 1 : 0);
    }
    
    sql += ' ORDER BY expiry_date ASC, name ASC';
    
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Fehler bei der Suche:', error);
    res.status(500).json({ error: 'Suchfehler' });
  }
});

// GET alle Materialien mit erweiterten Informationen
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('=== GET /api/materials ===');
    console.log('User:', { id: req.user?.id, isRoot: req.user?.isRoot, departmentId: req.user?.departmentId });
    
    const { category, cabinet, company, search, lowStock, expiring } = req.query;
    
    let query = 'SELECT * FROM v_materials_overview WHERE active = TRUE';
    const params: any[] = [];
    
    // Department-Filter hinzufügen (View braucht keinen Prefix)
    const departmentFilter = getDepartmentFilter(req, '');
    console.log('Department filter:', departmentFilter);
    
    if (departmentFilter.whereClause) {
      query += ` AND ${departmentFilter.whereClause}`;
      params.push(...departmentFilter.params);
    }
    
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
      query += ' AND (name LIKE ? OR description LIKE ? OR article_number LIKE ? OR lot_number LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
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
    // Department-Filter (View braucht keinen Prefix)
    const departmentFilter = getDepartmentFilter(req, '');
    let query = 'SELECT * FROM v_materials_overview WHERE id = ?';
    const params: any[] = [req.params.id];
    
    if (departmentFilter.whereClause) {
      query += ` AND ${departmentFilter.whereClause}`;
      params.push(...departmentFilter.params);
    }
    
    const [materialRows] = await pool.query<RowDataPacket[]>(query, params);
    
    if (materialRows.length === 0) {
      return res.status(404).json({ error: 'Material nicht gefunden oder kein Zugriff' });
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
    // Department-Validierung: Material muss zugänglich sein
    const departmentFilter = getDepartmentFilter(req, '');
    if (departmentFilter.whereClause) {
      const [materials] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM v_materials_overview WHERE id = ? AND ${departmentFilter.whereClause}`,
        [req.params.id, ...departmentFilter.params]
      );
      
      if (materials.length === 0) {
        return res.status(403).json({ error: 'Material nicht gefunden oder kein Zugriff' });
      }
    }
    
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
    category_id, company_id, cabinet_id, compartment_id, name, description,
    size, unit, min_stock, current_stock, expiry_date,
    lot_number, article_number, cost, location_in_cabinet, shipping_container_code, notes,
    custom_fields, barcodes, unit_id, is_consignment
  } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }
  
  // Department (unit_id) bestimmen: Entweder vom Request oder vom User
  let materialUnitId = unit_id;
  if (!materialUnitId && req.user?.departmentId) {
    materialUnitId = req.user.departmentId;
  }
  
  // Department-Validierung: Schrank muss im erlaubten Department sein
  if (cabinet_id && req.user?.departmentId && !req.user?.isRoot) {
    const [cabinets] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM cabinets WHERE id = ? AND unit_id = ?',
      [cabinet_id, req.user.departmentId]
    );
    
    if (cabinets.length === 0) {
      return res.status(403).json({ error: 'Schrank gehört nicht zu Ihrem Department' });
    }
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Material einfügen (inkl. unit_id!)
    // current_stock startet bei 1 (ein Material wird aufgenommen)
    // min_stock ist nicht mehr relevant für einzelne Materialien (nur Kategorien)
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO materials 
       (category_id, company_id, cabinet_id, compartment_id, unit_id, name, description, size, unit,
        min_stock, current_stock, expiry_date, lot_number, article_number, cost,
        location_in_cabinet, shipping_container_code, notes, is_consignment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category_id, company_id, cabinet_id, compartment_id || null, materialUnitId, name, description, size, unit,
        0, current_stock || 1, expiry_date, lot_number,
        article_number, cost || null, location_in_cabinet, shipping_container_code, notes, is_consignment || false
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
    category_id, company_id, cabinet_id, compartment_id, unit_id, name, description,
    size, unit, min_stock, expiry_date,
    lot_number, article_number, cost, location_in_cabinet, shipping_container_code, notes, active, is_consignment
  } = req.body;
  
  try {
    // Department-Validierung: Material muss im erlaubten Department sein
    const departmentFilter = getDepartmentFilter(req, '');
    if (departmentFilter.whereClause) {
      const [materials] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM v_materials_overview WHERE id = ? AND ${departmentFilter.whereClause}`,
        [req.params.id, ...departmentFilter.params]
      );
      
      if (materials.length === 0) {
        return res.status(403).json({ error: 'Material nicht gefunden oder kein Zugriff' });
      }
    }
    
    // Department-Validierung: Neuer Schrank muss im erlaubten Department sein (nur für nicht-Root)
    if (cabinet_id && req.user?.departmentId && !req.user?.isRoot) {
      const [cabinets] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cabinets WHERE id = ? AND unit_id = ?',
        [cabinet_id, req.user.departmentId]
      );
      
      if (cabinets.length === 0) {
        return res.status(403).json({ error: 'Schrank gehört nicht zu Ihrem Department' });
      }
    }
    
    // active sollte standardmäßig true sein, wenn nicht explizit gesetzt
    const isActive = active !== undefined ? active : true;
    
    // unit_id bestimmen: Vom Request oder vom User (für nicht-Root)
    let materialUnitId = unit_id;
    if (!materialUnitId && req.user?.departmentId && !req.user?.isRoot) {
      materialUnitId = req.user.departmentId;
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE materials 
       SET category_id = ?, company_id = ?, cabinet_id = ?, compartment_id = ?, unit_id = ?, name = ?,
           description = ?, size = ?, unit = ?, min_stock = ?,
           expiry_date = ?, lot_number = ?,
           article_number = ?, cost = ?, location_in_cabinet = ?, shipping_container_code = ?, notes = ?, active = ?, is_consignment = ?
       WHERE id = ?`,
      [
        category_id, company_id, cabinet_id, compartment_id || null, materialUnitId, name, description, size, unit,
        min_stock, expiry_date, lot_number, article_number, cost || null,
        location_in_cabinet, shipping_container_code, notes, isActive, is_consignment || false, req.params.id
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
  const { quantity, reference_number, notes } = req.body;
  
  // user_id und user_name vom authentifizierten User
  const userId = req.user?.id;
  const userName = req.user?.fullName || req.user?.username || 'Unbekannt';
  
  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Ungültige Menge' });
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Department-Validierung
    const departmentFilter = getDepartmentFilter(req, '');
    if (departmentFilter.whereClause) {
      const [materials] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM v_materials_overview WHERE id = ? AND ${departmentFilter.whereClause}`,
        [req.params.id, ...departmentFilter.params]
      );
      
      if (materials.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({ error: 'Material nicht gefunden oder kein Zugriff' });
      }
    }
    
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
       (material_id, transaction_type, quantity, previous_stock, new_stock, reference_number, notes, user_id, user_name, unit_id)
       VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?, (SELECT unit_id FROM materials WHERE id = ?))`,
      [req.params.id, quantity, previousStock, newStock, reference_number, notes, userId, userName, req.params.id]
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
  const { quantity, reference_number, notes, usage_type } = req.body;
  
  // user_id und user_name vom authentifizierten User
  const userId = req.user?.id;
  const userName = req.user?.fullName || req.user?.username || 'Unbekannt';
  
  // usage_type: patient_use (Protokollmodus), destock (normal), correction
  const validUsageType = ['patient_use', 'destock', 'correction'].includes(usage_type) ? usage_type : 'destock';
  
  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Ungültige Menge' });
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Department-Validierung
    const departmentFilter = getDepartmentFilter(req, '');
    if (departmentFilter.whereClause) {
      const [materials] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM v_materials_overview WHERE id = ? AND ${departmentFilter.whereClause}`,
        [req.params.id, ...departmentFilter.params]
      );
      
      if (materials.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({ error: 'Material nicht gefunden oder kein Zugriff' });
      }
    }
    
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
    
    // Material deaktivieren wenn Bestand auf 0 fällt
    const shouldDeactivate = newStock === 0;
    
    await connection.query(
      'UPDATE materials SET current_stock = ?, active = ? WHERE id = ?',
      [newStock, !shouldDeactivate, req.params.id]
    );
    
    await connection.query(
      `INSERT INTO material_transactions 
       (material_id, transaction_type, usage_type, quantity, previous_stock, new_stock, reference_number, notes, user_id, user_name, unit_id)
       VALUES (?, 'out', ?, ?, ?, ?, ?, ?, ?, ?, (SELECT unit_id FROM materials WHERE id = ?))`,
      [req.params.id, validUsageType, quantity, previousStock, newStock, reference_number, notes, userId, userName, req.params.id]
    );
    
    await connection.commit();
    
    res.json({
      message: shouldDeactivate ? 'Ausgang gebucht - Material deaktiviert (Bestand 0)' : 'Ausgang erfolgreich gebucht',
      previous_stock: previousStock,
      new_stock: newStock,
      deactivated: shouldDeactivate
    });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Materialausgang:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Datenbankfehler' });
  } finally {
    connection.release();
  }
});

// DELETE Material (soft delete) - mit Correction-Protokollierung
router.delete('/:id', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Department-Validierung
    const departmentFilter = getDepartmentFilter(req, '');
    if (departmentFilter.whereClause) {
      const [materials] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM v_materials_overview WHERE id = ? AND ${departmentFilter.whereClause}`,
        [req.params.id, ...departmentFilter.params]
      );
      
      if (materials.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({ error: 'Material nicht gefunden oder kein Zugriff' });
      }
    }
    
    // Hole aktuellen Bestand für Protokollierung
    const [materials] = await connection.query<RowDataPacket[]>(
      'SELECT current_stock, unit_id FROM materials WHERE id = ?',
      [req.params.id]
    );
    
    if (materials.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Material nicht gefunden' });
    }
    
    const previousStock = materials[0].current_stock;
    const unitId = materials[0].unit_id;
    const userId = req.user?.id;
    const userName = req.user?.fullName || req.user?.username || 'Unbekannt';
    
    // Nur protokollieren wenn Bestand > 0 war
    if (previousStock > 0) {
      await connection.query(
        `INSERT INTO material_transactions 
         (material_id, transaction_type, usage_type, quantity, previous_stock, new_stock, notes, user_id, user_name, unit_id)
         VALUES (?, 'out', 'correction', ?, ?, 0, 'Korrektur: Material über Tabelle gelöscht', ?, ?, ?)`,
        [req.params.id, previousStock, previousStock, userId, userName, unitId]
      );
    }
    
    // Material deaktivieren und Bestand auf 0 setzen
    await connection.query(
      'UPDATE materials SET active = FALSE, current_stock = 0 WHERE id = ?',
      [req.params.id]
    );
    
    await connection.commit();
    
    res.json({ message: 'Material erfolgreich deaktiviert' });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Löschen des Materials:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  } finally {
    connection.release();
  }
});

// POST Material reaktivieren
router.post('/:id/reactivate', async (req: Request, res: Response) => {
  try {
    // Department-Validierung
    const departmentFilter = getDepartmentFilter(req, '');
    if (departmentFilter.whereClause) {
      const [materials] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM v_materials_overview WHERE id = ? AND ${departmentFilter.whereClause}`,
        [req.params.id, ...departmentFilter.params]
      );
      
      if (materials.length === 0) {
        return res.status(403).json({ error: 'Material nicht gefunden oder kein Zugriff' });
      }
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE materials SET active = TRUE WHERE id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Material nicht gefunden' });
    }
    
    res.json({ message: 'Material erfolgreich reaktiviert' });
  } catch (error) {
    console.error('Fehler beim Reaktivieren des Materials:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET ablaufende Materialien
router.get('/reports/expiring', async (req: Request, res: Response) => {
  try {
    // Views verwenden direkt die Spalten ohne Alias, daher '' statt 'm'
    const departmentFilter = getDepartmentFilter(req, '');
    let query = 'SELECT * FROM v_expiring_materials';
    const params: any[] = [];
    
    if (departmentFilter.whereClause) {
      query += ` WHERE ${departmentFilter.whereClause}`;
      params.push(...departmentFilter.params);
    }
    
    console.log('[REPORTS] Expiring materials query:', query, 'params:', params);
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    console.log('[REPORTS] Expiring materials found:', rows.length);
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen ablaufender Materialien:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Kategorien mit niedrigem Bestand (basierend auf category.min_quantity)
router.get('/reports/low-stock', async (req: Request, res: Response) => {
  try {
    let query = 'SELECT * FROM v_low_stock_categories';
    const params: any[] = [];
    
    // Department-Filter für Non-Root
    if (!req.user?.isRoot && req.user?.departmentId) {
      query += ' WHERE department_id = ?';
      params.push(req.user.departmentId);
    }
    
    console.log('[REPORTS] Low stock categories query:', query, 'params:', params);
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    console.log('[REPORTS] Low stock categories found:', rows.length);
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Kategorien mit niedrigem Bestand:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
