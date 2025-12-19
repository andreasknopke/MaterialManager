import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { authenticate } from '../middleware/auth';
import { getDepartmentFilter } from '../utils/departmentFilter';
import { auditMaterial } from '../utils/auditLogger';

const router = Router();

// Alle Routes benötigen Authentifizierung
router.use(authenticate);

// GET Produktnamen-Vorschläge für Autocomplete
router.get('/product-names', async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    
    // Wenn kein Suchbegriff, gib leere Liste zurück
    if (!search || String(search).length < 1) {
      return res.json([]);
    }
    
    const searchTerm = `${search}%`;
    
    // Suche einzigartige Produktnamen aus der products-Tabelle
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT name FROM products 
       WHERE name LIKE ? 
       ORDER BY name 
       LIMIT 20`,
      [searchTerm]
    );
    
    const names = rows.map((row: RowDataPacket) => row.name);
    res.json(names);
  } catch (error) {
    console.error('Fehler beim Abrufen der Produktnamen:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Material-Template anhand Name (für Auto-Fill bei Namenseingabe)
router.get('/by-name/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    if (!name || name.length < 3) {
      return res.status(400).json({ error: 'Name zu kurz (min. 3 Zeichen)' });
    }
    
    // Department-Filter
    const departmentFilter = getDepartmentFilter(req, '');
    
    // Suche Material mit exakt diesem Namen (case-insensitive)
    let query = `
      SELECT m.*, c.name as category_name, co.name as company_name
      FROM materials m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN companies co ON m.company_id = co.id
      WHERE LOWER(TRIM(m.name)) = LOWER(TRIM(?))
    `;
    const params: any[] = [name];
    
    if (departmentFilter.whereClause) {
      query += ` AND ${departmentFilter.whereClause.replace('unit_id', 'm.unit_id')}`;
      params.push(...departmentFilter.params);
    }
    
    query += ' ORDER BY m.created_at DESC LIMIT 1';
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Kein Material mit diesem Namen gefunden' });
    }
    
    // Gib Template-Daten zurück (Kategorie und Firma)
    const material = rows[0];
    res.json({
      found: true,
      template: {
        category_id: material.category_id,
        category_name: material.category_name,
        company_id: material.company_id,
        company_name: material.company_name,
      }
    });
  } catch (error) {
    console.error('Fehler beim Suchen nach Name:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Material-Template anhand GTIN (für Auto-Fill beim Scannen)
// Nutzt jetzt die normalisierte products-Tabelle
router.get('/by-gtin/:gtin', async (req: Request, res: Response) => {
  try {
    const { gtin } = req.params;
    
    if (!gtin || gtin.length < 8) {
      return res.status(400).json({ error: 'Ungültige GTIN' });
    }
    
    // Department-Filter
    const departmentFilter = getDepartmentFilter(req, '');
    
    // === Zuerst in products-Tabelle suchen (normalisierte Stammdaten) ===
    const [products] = await pool.query<RowDataPacket[]>(
      `SELECT p.id as product_id, p.gtin, p.name, p.description, p.size,
              p.company_id, co.name as company_name,
              p.shape_id, p.shaft_length, p.device_length, p.device_diameter, 
              p.french_size, p.guidewire_acceptance, p.cost, p.notes
       FROM products p
       LEFT JOIN companies co ON p.company_id = co.id
       WHERE p.gtin = ?
       LIMIT 1`,
      [gtin]
    );
    
    if (products.length > 0) {
      // Produkt gefunden - hole letzte Instanz-Daten für Kategorie/Schrank
      let instanceQuery = `
        SELECT m.category_id, c.name as category_name, m.cabinet_id, m.compartment_id,
               m.unit_id, m.unit, m.location_in_cabinet, m.is_consignment
        FROM materials m
        LEFT JOIN categories c ON m.category_id = c.id
        WHERE m.product_id = ? AND m.active = TRUE
      `;
      const instanceParams: any[] = [products[0].product_id];
      
      if (departmentFilter.whereClause) {
        instanceQuery += ` AND ${departmentFilter.whereClause.replace('unit_id', 'm.unit_id')}`;
        instanceParams.push(...departmentFilter.params);
      }
      instanceQuery += ' ORDER BY m.created_at DESC LIMIT 1';
      
      const [instances] = await pool.query<RowDataPacket[]>(instanceQuery, instanceParams);
      const lastInstance = instances[0] || {};
      
      return res.json({
        found: true,
        fromProducts: true,
        template: {
          product_id: products[0].product_id,
          name: products[0].name,
          description: products[0].description,
          size: products[0].size,
          company_id: products[0].company_id,
          company_name: products[0].company_name,
          shape_id: products[0].shape_id,
          shaft_length: products[0].shaft_length,
          device_length: products[0].device_length,
          device_diameter: products[0].device_diameter,
          french_size: products[0].french_size,
          guidewire_acceptance: products[0].guidewire_acceptance,
          cost: products[0].cost,
          article_number: products[0].gtin,
          // Instanz-Daten vom letzten Material
          category_id: lastInstance.category_id,
          category_name: lastInstance.category_name,
          cabinet_id: lastInstance.cabinet_id,
          compartment_id: lastInstance.compartment_id,
          unit_id: lastInstance.unit_id,
          unit: lastInstance.unit,
          location_in_cabinet: lastInstance.location_in_cabinet,
          is_consignment: lastInstance.is_consignment || false
        }
      });
    }
    
    // === Fallback: Suche in materials (für alte Daten ohne product_id) ===
    let query = `
      SELECT m.*, c.name as category_name, co.name as company_name
      FROM materials m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN companies co ON m.company_id = co.id
      WHERE m.article_number = ?
    `;
    const params: any[] = [gtin];
    
    if (departmentFilter.whereClause) {
      query += ` AND ${departmentFilter.whereClause.replace('unit_id', 'm.unit_id')}`;
      params.push(...departmentFilter.params);
    }
    
    query += ' ORDER BY m.created_at DESC LIMIT 1';
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Kein Material mit dieser GTIN gefunden' });
    }
    
    // Gib Template-Daten zurück (ohne unique Felder wie LOT, Verfallsdatum)
    const material = rows[0];
    res.json({
      found: true,
      fromProducts: false,
      template: {
        name: material.name,
        description: material.description,
        category_id: material.category_id,
        category_name: material.category_name,
        company_id: material.company_id,
        company_name: material.company_name,
        cabinet_id: material.cabinet_id,
        compartment_id: material.compartment_id,
        unit_id: material.unit_id,
        size: material.size,
        unit: material.unit,
        article_number: material.article_number,
        cost: material.cost,
        location_in_cabinet: material.location_in_cabinet,
        is_consignment: material.is_consignment,
        // Device-Eigenschaften
        shape_id: material.shape_id,
        shaft_length: material.shaft_length,
        device_length: material.device_length,
        device_diameter: material.device_diameter,
        french_size: material.french_size,
        guidewire_acceptance: material.guidewire_acceptance
      }
    });
  } catch (error) {
    console.error('Fehler beim Suchen nach GTIN:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

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
    
    // Basis-Query mit offenen Bestellungen als Subquery
    let query = `SELECT v.*, 
      (SELECT COUNT(*) FROM reorder_history rh WHERE rh.product_id = v.product_id AND rh.status = 'ordered') as pending_orders
      FROM v_materials_overview v WHERE v.active = TRUE`;
    const params: any[] = [];
    
    // Department-Filter hinzufügen (View braucht keinen Prefix)
    const departmentFilter = getDepartmentFilter(req, 'v');
    console.log('Department filter:', departmentFilter);
    
    if (departmentFilter.whereClause) {
      query += ` AND ${departmentFilter.whereClause}`;
      params.push(...departmentFilter.params);
    }
    
    if (category) {
      query += ' AND v.category_name = ?';
      params.push(category);
    }
    
    if (cabinet) {
      query += ' AND v.cabinet_name = ?';
      params.push(cabinet);
    }
    
    if (company) {
      query += ' AND v.company_name = ?';
      params.push(company);
    }
    
    if (search) {
      query += ' AND (v.name LIKE ? OR v.description LIKE ? OR v.article_number LIKE ? OR v.lot_number LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    if (lowStock === 'true') {
      query += ' AND v.stock_status = "LOW"';
    }
    
    if (expiring === 'true') {
      query += ' AND v.stock_status = "EXPIRING"';
    }
    
    query += ' ORDER BY v.name';
    
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
    custom_fields, barcodes, unit_id, is_consignment,
    shape_id, shaft_length, device_length, device_diameter, french_size, guidewire_acceptance
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
    
    // === NORMALISIERUNG: Produkt-ID ermitteln oder neues Produkt erstellen ===
    let productId: number | null = null;
    
    if (article_number) {
      // Prüfen ob Produkt mit dieser GTIN bereits existiert
      const [existingProducts] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM products WHERE gtin = ?',
        [article_number]
      );
      
      if (existingProducts.length > 0) {
        // Produkt existiert - ID verwenden
        productId = existingProducts[0].id;
        console.log(`Bestehendes Produkt gefunden (ID: ${productId}) für GTIN: ${article_number}`);
      } else {
        // Neues Produkt erstellen
        const [productResult] = await connection.query<ResultSetHeader>(
          `INSERT INTO products 
           (gtin, name, description, size, company_id, shape_id, 
            shaft_length, device_length, device_diameter, french_size, guidewire_acceptance, cost, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [article_number, name, description, size, company_id, shape_id || null,
           shaft_length || null, device_length || null, device_diameter || null, 
           french_size || null, guidewire_acceptance || null, cost || null, notes]
        );
        productId = productResult.insertId;
        console.log(`Neues Produkt erstellt (ID: ${productId}) für GTIN: ${article_number}`);
      }
    }
    
    // Material einfügen (inkl. product_id und unit_id!)
    // current_stock startet bei 1 (ein Material wird aufgenommen)
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO materials 
       (product_id, category_id, company_id, cabinet_id, compartment_id, unit_id, name, description, size, unit,
        min_stock, current_stock, expiry_date, lot_number, article_number, cost,
        location_in_cabinet, shipping_container_code, notes, is_consignment,
        shape_id, shaft_length, device_length, device_diameter, french_size, guidewire_acceptance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productId, category_id, company_id, cabinet_id, compartment_id || null, materialUnitId, name, description, size, unit,
        0, current_stock || 1, expiry_date, lot_number,
        article_number, cost || null, location_in_cabinet, shipping_container_code, notes, is_consignment || false,
        shape_id || null, shaft_length || null, device_length || null, device_diameter || null, french_size || null, guidewire_acceptance || null
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
    
    // Barcodes einfügen (mit UPSERT für bereits existierende Barcodes)
    if (barcodes && Array.isArray(barcodes)) {
      for (const barcode of barcodes) {
        // Falls Barcode bereits existiert, aktualisiere die Verknüpfung zum neuen Material
        await connection.query(
          `INSERT INTO barcodes (material_id, barcode, barcode_type, is_primary) 
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE material_id = VALUES(material_id), is_primary = VALUES(is_primary)`,
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
    
    // Audit-Log erstellen
    await auditMaterial.create(req, { id: materialId, name }, {
      category_id, company_id, cabinet_id, compartment_id, 
      current_stock: current_stock || 1, lot_number, article_number, unit_id: materialUnitId
    });
    
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
    lot_number, article_number, cost, location_in_cabinet, shipping_container_code, notes, active, is_consignment,
    shape_id, shaft_length, device_length, device_diameter, french_size, guidewire_acceptance
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
           article_number = ?, cost = ?, location_in_cabinet = ?, shipping_container_code = ?, notes = ?, active = ?, is_consignment = ?,
           shape_id = ?, shaft_length = ?, device_length = ?, device_diameter = ?, french_size = ?, guidewire_acceptance = ?
       WHERE id = ?`,
      [
        category_id, company_id, cabinet_id, compartment_id || null, materialUnitId, name, description, size, unit,
        min_stock, expiry_date, lot_number, article_number, cost || null,
        location_in_cabinet, shipping_container_code, notes, isActive, is_consignment || false,
        shape_id || null, shaft_length || null, device_length || null, device_diameter || null, french_size || null, guidewire_acceptance || null,
        req.params.id
      ]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Material nicht gefunden' });
    }
    
    // === NORMALISIERT: Stammdaten in products-Tabelle aktualisieren ===
    // Statt alle Materialien mit gleicher GTIN zu aktualisieren,
    // aktualisieren wir nur das verknüpfte Produkt (falls vorhanden)
    let productUpdated = false;
    if (article_number && article_number.trim() !== '') {
      // Prüfen ob Produkt mit dieser GTIN existiert
      const [existingProduct] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM products WHERE gtin = ?',
        [article_number]
      );
      
      if (existingProduct.length > 0) {
        // Produkt-Stammdaten aktualisieren
        await pool.query(
          `UPDATE products SET
            name = ?, description = ?, size = ?, company_id = ?,
            shape_id = ?, shaft_length = ?, device_length = ?, device_diameter = ?,
            french_size = ?, guidewire_acceptance = ?, cost = ?
           WHERE gtin = ?`,
          [name, description, size, company_id,
           shape_id || null, shaft_length || null, device_length || null, device_diameter || null,
           french_size || null, guidewire_acceptance || null, cost || null,
           article_number]
        );
        productUpdated = true;
        console.log(`Produkt-Stammdaten für GTIN ${article_number} aktualisiert`);
        
        // Material mit Produkt verknüpfen falls noch nicht geschehen
        await pool.query(
          'UPDATE materials SET product_id = ? WHERE id = ? AND product_id IS NULL',
          [existingProduct[0].id, req.params.id]
        );
      }
    }
    
    res.json({ 
      message: 'Material erfolgreich aktualisiert',
      productUpdated: productUpdated,
      // relatedUpdated entfernt - nicht mehr nötig mit normalisierter DB
      relatedUpdated: 0
    });
    
    // Audit-Log erstellen (nach Response für Performance)
    await auditMaterial.update(req, { id: Number(req.params.id), name }, 
      {}, // Old values - nicht einfach zu ermitteln ohne zusätzliche Query
      { category_id, company_id, cabinet_id, name, lot_number, article_number, is_consignment }
    );
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Materials:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST Material-Eingang
router.post('/:id/stock-in', async (req: Request, res: Response) => {
  const { quantity, reference_number, notes, usage_type } = req.body;
  
  // user_id und user_name vom authentifizierten User
  const userId = req.user?.id;
  const userName = req.user?.fullName || req.user?.username || 'Unbekannt';
  
  // usage_type: stock_in (normal), correction (Inventur-Korrektur)
  const validUsageType = ['stock_in', 'correction'].includes(usage_type) ? usage_type : 'stock_in';
  
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
    
    // Transaktion aufzeichnen (mit usage_type)
    await connection.query(
      `INSERT INTO material_transactions 
       (material_id, transaction_type, usage_type, quantity, previous_stock, new_stock, reference_number, notes, user_id, user_name, unit_id)
       VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?, ?, (SELECT unit_id FROM materials WHERE id = ?))`,
      [req.params.id, validUsageType, quantity, previousStock, newStock, reference_number, notes, userId, userName, req.params.id]
    );
    
    await connection.commit();
    
    // Audit-Log für Stock-In
    const [materialInfo] = await pool.query<RowDataPacket[]>(
      'SELECT name FROM materials WHERE id = ?',
      [req.params.id]
    );
    if (materialInfo.length > 0) {
      await auditMaterial.stockIn(req, { id: Number(req.params.id), name: materialInfo[0].name }, quantity, previousStock);
    }
    
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
    
    // Audit-Log für Stock-Out
    const [materialInfo] = await pool.query<RowDataPacket[]>(
      'SELECT name FROM materials WHERE id = ?',
      [req.params.id]
    );
    if (materialInfo.length > 0) {
      await auditMaterial.stockOut(req, { id: Number(req.params.id), name: materialInfo[0].name }, quantity, previousStock);
    }
    
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
    
    // Audit-Log für Delete
    const [materialInfo] = await pool.query<RowDataPacket[]>(
      'SELECT name FROM materials WHERE id = ?',
      [req.params.id]
    );
    if (materialInfo.length > 0) {
      await auditMaterial.delete(req, { id: Number(req.params.id), name: materialInfo[0].name });
    }
    
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

// GET Inaktive Bestände - Materialien, die lange nicht bewegt wurden
router.get('/reports/inactive', async (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string) || 6;
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    
    // Suche Materialien, deren letztes Update (oder Erstellung) vor dem Cutoff-Datum liegt
    // und die noch Bestand haben
    let query = `
      SELECT 
        m.id,
        m.name,
        m.article_number,
        m.lot_number,
        m.current_stock,
        m.min_stock,
        m.expiry_date,
        m.unit_id,
        m.updated_at,
        m.created_at,
        c.name AS category_name,
        co.name AS company_name,
        cab.name AS cabinet_name,
        cab.location AS cabinet_location,
        DATEDIFF(CURDATE(), COALESCE(m.updated_at, m.created_at)) AS days_inactive,
        ROUND(DATEDIFF(CURDATE(), COALESCE(m.updated_at, m.created_at)) / 30, 1) AS months_inactive
      FROM materials m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN companies co ON m.company_id = co.id
      LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
      WHERE m.active = TRUE
        AND m.current_stock > 0
        AND COALESCE(m.updated_at, m.created_at) < ?
    `;
    const params: any[] = [cutoffDate.toISOString().slice(0, 19).replace('T', ' ')];
    
    // Department-Filter für Non-Root
    if (!req.user?.isRoot && req.user?.departmentId) {
      query += ' AND m.unit_id = ?';
      params.push(req.user.departmentId);
    }
    
    query += ' ORDER BY days_inactive DESC';
    
    console.log('[REPORTS] Inactive materials query, months:', months, 'cutoff:', cutoffDate);
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    console.log('[REPORTS] Inactive materials found:', rows.length);
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen inaktiver Materialien:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
