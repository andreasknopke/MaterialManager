import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

const router = Router();

// GET Stammdaten nach GTIN (Artikelnummer) suchen - für Vorbelegung bei bekannter GTIN
router.get('/gtin/:gtin', async (req: Request, res: Response) => {
  try {
    // Suche nach Material mit dieser GTIN (article_number)
    const [materials] = await pool.query<RowDataPacket[]>(
      `SELECT m.name, m.description, m.category_id, m.company_id, m.unit, m.size,
              m.cabinet_id, cab.name as cabinet_name,
              c.name as category_name, co.name as company_name
       FROM materials m
       LEFT JOIN categories c ON m.category_id = c.id
       LEFT JOIN companies co ON m.company_id = co.id
       LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
       WHERE m.article_number = ? AND m.active = TRUE
       ORDER BY m.created_at DESC
       LIMIT 1`,
      [req.params.gtin]
    );
    
    if (materials.length === 0) {
      return res.status(404).json({ found: false, message: 'GTIN nicht bekannt' });
    }
    
    // Stammdaten gefunden
    res.json({
      found: true,
      masterData: {
        name: materials[0].name,
        description: materials[0].description,
        category_id: materials[0].category_id,
        company_id: materials[0].company_id,
        unit: materials[0].unit,
        size: materials[0].size,
        cabinet_id: materials[0].cabinet_id,
        cabinet_name: materials[0].cabinet_name,
        category_name: materials[0].category_name,
        company_name: materials[0].company_name,
      }
    });
  } catch (error) {
    console.error('Fehler bei der GTIN-Suche:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET alle Materialien mit einer bestimmten GTIN (für Entnahme-Auswahl)
// Aggregiert nach Schrank und Charge (gleiche Charge im gleichen Schrank = 1 Eintrag)
router.get('/gtin/:gtin/materials', async (req: Request, res: Response) => {
  try {
    // Materialien mit gleicher GTIN, Schrank und Charge zusammenfassen
    const [materials] = await pool.query<RowDataPacket[]>(
      `SELECT 
         GROUP_CONCAT(m.id) as material_ids,
         MIN(m.id) as id,
         m.name,
         SUM(m.current_stock) as current_stock,
         m.lot_number as batch_number,
         MIN(m.expiry_date) as expiry_date,
         m.cabinet_id,
         c.name as cabinet_name,
         m.article_number,
         COUNT(*) as item_count
       FROM materials m
       LEFT JOIN cabinets c ON m.cabinet_id = c.id
       WHERE m.article_number = ? AND m.active = TRUE AND m.current_stock > 0
       GROUP BY m.cabinet_id, m.lot_number, m.name, m.article_number, c.name
       ORDER BY MIN(m.expiry_date) ASC, MIN(m.created_at) ASC`,
      [req.params.gtin]
    );
    
    res.json({
      materials: materials,
      count: materials.length
    });
  } catch (error) {
    console.error('Fehler bei der GTIN-Material-Suche:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Barcode suchen
router.get('/search/:barcode', async (req: Request, res: Response) => {
  try {
    const [barcodeRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM barcodes WHERE barcode = ?',
      [req.params.barcode]
    );
    
    if (barcodeRows.length === 0) {
      return res.status(404).json({ error: 'Barcode nicht gefunden' });
    }
    
    const barcode = barcodeRows[0];
    
    // Material-Informationen abrufen
    const [materialRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM v_materials_overview WHERE id = ?',
      [barcode.material_id]
    );
    
    if (materialRows.length === 0) {
      return res.status(404).json({ error: 'Material nicht gefunden' });
    }
    
    res.json({
      barcode: barcode,
      material: materialRows[0]
    });
  } catch (error) {
    console.error('Fehler bei der Barcode-Suche:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET alle Barcodes eines Materials
router.get('/material/:materialId', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM barcodes WHERE material_id = ? ORDER BY is_primary DESC, created_at',
      [req.params.materialId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Barcodes:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST neuer Barcode
router.post('/', async (req: Request, res: Response) => {
  const { material_id, barcode, barcode_type, is_primary } = req.body;
  
  if (!material_id || !barcode) {
    return res.status(400).json({ error: 'Material-ID und Barcode sind erforderlich' });
  }
  
  try {
    // Wenn is_primary = true, alle anderen Barcodes des Materials auf false setzen
    if (is_primary) {
      await pool.query(
        'UPDATE barcodes SET is_primary = FALSE WHERE material_id = ?',
        [material_id]
      );
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO barcodes (material_id, barcode, barcode_type, is_primary) VALUES (?, ?, ?, ?)',
      [material_id, barcode, barcode_type || 'CODE128', is_primary || false]
    );
    
    res.status(201).json({
      id: result.insertId,
      message: 'Barcode erfolgreich erstellt'
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Barcode existiert bereits' });
    }
    console.error('Fehler beim Erstellen des Barcodes:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT Barcode aktualisieren
router.put('/:id', async (req: Request, res: Response) => {
  const { barcode, barcode_type, is_primary } = req.body;
  
  try {
    // Wenn is_primary = true, Material-ID ermitteln und andere Barcodes auf false setzen
    if (is_primary) {
      const [existingBarcode] = await pool.query<RowDataPacket[]>(
        'SELECT material_id FROM barcodes WHERE id = ?',
        [req.params.id]
      );
      
      if (existingBarcode.length > 0) {
        await pool.query(
          'UPDATE barcodes SET is_primary = FALSE WHERE material_id = ? AND id != ?',
          [existingBarcode[0].material_id, req.params.id]
        );
      }
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE barcodes SET barcode = ?, barcode_type = ?, is_primary = ? WHERE id = ?',
      [barcode, barcode_type, is_primary, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Barcode nicht gefunden' });
    }
    
    res.json({ message: 'Barcode erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Barcodes:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE Barcode
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM barcodes WHERE id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Barcode nicht gefunden' });
    }
    
    res.json({ message: 'Barcode erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Barcodes:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST Barcode scannen und Material-Ausgang buchen
// POST Entnahme direkt über Material-ID(s) (für GTIN-Workflow)
// Unterstützt sowohl einzelne ID als auch komma-separierte IDs (für aggregierte Materialien)
router.post('/material/:materialId/remove', async (req: Request, res: Response) => {
  const materialIdParam = req.params.materialId;
  const { quantity, user_name, notes, usage_type } = req.body;
  
  // usage_type: patient_use (Protokollmodus), destock (normal)
  const validUsageType = ['patient_use', 'destock'].includes(usage_type) ? usage_type : 'destock';
  
  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: 'Gültige Menge ist erforderlich' });
  }
  
  // Unterstütze komma-separierte IDs (z.B. "4,5,6")
  const materialIds = materialIdParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
  
  if (materialIds.length === 0) {
    return res.status(400).json({ error: 'Keine gültige Material-ID angegeben' });
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    let remainingQuantity = quantity;
    let totalPreviousStock = 0;
    let totalNewStock = 0;
    let materialName = '';
    let processedMaterials: number[] = [];
    
    // Alle Materialien mit Bestand laden (älteste zuerst nach Verfallsdatum)
    const [materials] = await connection.query<RowDataPacket[]>(
      `SELECT id, current_stock, name, expiry_date FROM materials 
       WHERE id IN (?) AND active = TRUE AND current_stock > 0
       ORDER BY expiry_date ASC, created_at ASC`,
      [materialIds]
    );
    
    if (materials.length === 0) {
      throw new Error('Keine aktiven Materialien mit Bestand gefunden');
    }
    
    // Entnehme aus den Materialien (FIFO nach Verfallsdatum)
    for (const mat of materials) {
      if (remainingQuantity <= 0) break;
      
      materialName = mat.name;
      const takeFromThis = Math.min(remainingQuantity, mat.current_stock);
      const newStock = mat.current_stock - takeFromThis;
      
      totalPreviousStock += mat.current_stock;
      totalNewStock += newStock;
      remainingQuantity -= takeFromThis;
      processedMaterials.push(mat.id);
      
      // Bestand aktualisieren
      await connection.query(
        'UPDATE materials SET current_stock = ?, active = ? WHERE id = ?',
        [newStock, newStock > 0, mat.id]
      );
      
      // Transaktion aufzeichnen
      await connection.query(
        `INSERT INTO material_transactions 
         (material_id, transaction_type, usage_type, quantity, previous_stock, new_stock, notes, user_name)
         VALUES (?, 'out', ?, ?, ?, ?, ?, ?)`,
        [mat.id, validUsageType, takeFromThis, mat.current_stock, newStock, notes || 'GTIN-Scan Entnahme', user_name || 'System']
      );
    }
    
    if (remainingQuantity > 0) {
      throw new Error(`Nicht genügend Bestand verfügbar. Fehlend: ${remainingQuantity}`);
    }
    
    await connection.commit();
    
    res.json({
      message: totalNewStock === 0 ? 'Material vollständig entnommen und deaktiviert' : 'Entnahme erfolgreich',
      material_ids: processedMaterials,
      material_name: materialName,
      previous_stock: totalPreviousStock,
      new_stock: totalNewStock,
      quantity_removed: quantity,
      deactivated: totalNewStock === 0
    });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler bei der Material-Entnahme:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Datenbankfehler' });
  } finally {
    connection.release();
  }
});

router.post('/scan-out', async (req: Request, res: Response) => {
  const { barcode, quantity, user_name, notes, usage_type } = req.body;
  
  // usage_type: patient_use (Protokollmodus), destock (normal)
  const validUsageType = ['patient_use', 'destock'].includes(usage_type) ? usage_type : 'destock';
  
  if (!barcode || !quantity) {
    return res.status(400).json({ error: 'Barcode und Menge sind erforderlich' });
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Barcode suchen
    const [barcodeRows] = await connection.query<RowDataPacket[]>(
      'SELECT material_id FROM barcodes WHERE barcode = ?',
      [barcode]
    );
    
    if (barcodeRows.length === 0) {
      throw new Error('Barcode nicht gefunden');
    }
    
    const materialId = barcodeRows[0].material_id;
    
    // Bestand prüfen und aktualisieren
    const [materials] = await connection.query<RowDataPacket[]>(
      'SELECT current_stock FROM materials WHERE id = ?',
      [materialId]
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
      [newStock, materialId]
    );
    
    // Transaktion aufzeichnen
    await connection.query(
      `INSERT INTO material_transactions 
       (material_id, transaction_type, usage_type, quantity, previous_stock, new_stock, notes, user_name)
       VALUES (?, 'out', ?, ?, ?, ?, ?, ?)`,
      [materialId, validUsageType, quantity, previousStock, newStock, notes || 'Barcode-Scan Ausgang', user_name]
    );
    
    await connection.commit();
    
    res.json({
      message: 'Ausgang erfolgreich gebucht',
      material_id: materialId,
      previous_stock: previousStock,
      new_stock: newStock
    });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Barcode-Scan:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Datenbankfehler' });
  } finally {
    connection.release();
  }
});

export default router;
