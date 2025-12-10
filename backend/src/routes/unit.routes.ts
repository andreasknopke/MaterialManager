import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

const router = Router();

// GET alle Einheiten
router.get('/', async (req: Request, res: Response) => {
  try {
    const { active } = req.query;
    
    let query = 'SELECT * FROM units';
    const params: any[] = [];
    
    if (active === 'true') {
      query += ' WHERE active = TRUE';
    }
    
    query += ' ORDER BY name';
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Einheiten:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET eine Einheit nach ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM units WHERE id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Einheit nicht gefunden' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen der Einheit:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Statistiken einer Einheit
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const unitId = req.params.id;
    
    // Material-Anzahl
    const [materialCount] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM materials WHERE unit_id = ? AND active = TRUE',
      [unitId]
    );
    
    // Schrank-Anzahl
    const [cabinetCount] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM cabinets WHERE unit_id = ? AND active = TRUE',
      [unitId]
    );
    
    // Gesamtbestand
    const [stockSum] = await pool.query<RowDataPacket[]>(
      'SELECT COALESCE(SUM(current_stock), 0) as total FROM materials WHERE unit_id = ? AND active = TRUE',
      [unitId]
    );
    
    // Materialien mit niedrigem Bestand
    const [lowStock] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM materials WHERE unit_id = ? AND current_stock <= min_stock AND active = TRUE',
      [unitId]
    );
    
    // Ablaufende Materialien (30 Tage)
    const [expiring] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM materials 
       WHERE unit_id = ? 
       AND expiry_date IS NOT NULL 
       AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) 
       AND active = TRUE`,
      [unitId]
    );
    
    res.json({
      materials: materialCount[0].count,
      cabinets: cabinetCount[0].count,
      totalStock: stockSum[0].total,
      lowStockMaterials: lowStock[0].count,
      expiringMaterials: expiring[0].count,
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Einheiten-Statistiken:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST neue Einheit erstellen
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, color, active } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO units (name, description, color, active) VALUES (?, ?, ?, ?)',
      [name, description || null, color || '#1976d2', active !== false]
    );
    
    const [newUnit] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM units WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(newUnit[0]);
  } catch (error: any) {
    console.error('Fehler beim Erstellen der Einheit:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Eine Einheit mit diesem Namen existiert bereits' });
    }
    
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT Einheit aktualisieren
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, color, active } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }
    
    const isActive = active !== false;
    
    await pool.query(
      `UPDATE units 
       SET name = ?, description = ?, color = ?, active = ?
       WHERE id = ?`,
      [name, description || null, color || '#1976d2', isActive, req.params.id]
    );
    
    const [updated] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM units WHERE id = ?',
      [req.params.id]
    );
    
    if (updated.length === 0) {
      return res.status(404).json({ error: 'Einheit nicht gefunden' });
    }
    
    res.json(updated[0]);
  } catch (error: any) {
    console.error('Fehler beim Aktualisieren der Einheit:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Eine Einheit mit diesem Namen existiert bereits' });
    }
    
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE Einheit löschen
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Prüfe ob Einheit noch verwendet wird
    const [materials] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM materials WHERE unit_id = ?',
      [req.params.id]
    );
    
    const [cabinets] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM cabinets WHERE unit_id = ?',
      [req.params.id]
    );
    
    if (materials[0].count > 0 || cabinets[0].count > 0) {
      return res.status(409).json({ 
        error: 'Einheit kann nicht gelöscht werden, da noch Materialien oder Schränke zugeordnet sind',
        materials: materials[0].count,
        cabinets: cabinets[0].count
      });
    }
    
    await pool.query('DELETE FROM units WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'Einheit erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen der Einheit:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Material-Transfers einer Einheit
router.get('/:id/transfers', async (req: Request, res: Response) => {
  try {
    const unitId = req.params.id;
    const { type } = req.query; // 'incoming' oder 'outgoing'
    
    let query = `
      SELECT 
        mt.*,
        m.name as material_name,
        m.article_number,
        fu.name as from_unit_name,
        fu.color as from_unit_color,
        tu.name as to_unit_name,
        tu.color as to_unit_color
      FROM material_transfers mt
      LEFT JOIN materials m ON mt.material_id = m.id
      LEFT JOIN units fu ON mt.from_unit_id = fu.id
      LEFT JOIN units tu ON mt.to_unit_id = tu.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (type === 'incoming') {
      query += ' AND mt.to_unit_id = ?';
      params.push(unitId);
    } else if (type === 'outgoing') {
      query += ' AND mt.from_unit_id = ?';
      params.push(unitId);
    } else {
      query += ' AND (mt.from_unit_id = ? OR mt.to_unit_id = ?)';
      params.push(unitId, unitId);
    }
    
    query += ' ORDER BY mt.transfer_date DESC LIMIT 100';
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Transfers:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
