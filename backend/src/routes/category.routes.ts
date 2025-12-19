import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { authenticate } from '../middleware/auth';

const router = Router();

// Alle Routes benötigen Authentifizierung
router.use(authenticate);

// GET alle Kategorien (gefiltert nach Abteilung)
router.get('/', async (req: Request, res: Response) => {
  try {
    let query = 'SELECT * FROM categories';
    const params: any[] = [];
    const conditions: string[] = [];
    
    // Root sieht alle Kategorien, andere nur ihre Abteilungs-Kategorien
    if (!req.user?.isRoot && req.user?.departmentId) {
      conditions.push('unit_id = ?');
      params.push(req.user.departmentId);
    } else if (!req.user?.isRoot && !req.user?.departmentId) {
      // User ohne Department sieht nichts
      conditions.push('1 = 0');
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY name';
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Kategorien:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Kategorie nach ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    let query = 'SELECT * FROM categories WHERE id = ?';
    const params: any[] = [req.params.id];
    
    // Non-Root User können nur Kategorien ihrer Abteilung sehen
    if (!req.user?.isRoot && req.user?.departmentId) {
      query += ' AND unit_id = ?';
      params.push(req.user.departmentId);
    }
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen der Kategorie:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST neue Kategorie
router.post('/', async (req: Request, res: Response) => {
  const { name, description, min_quantity, ops_code, zusatzentgelt, endo_today_link } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }
  
  // Abteilungs-ID: Root kann für beliebige Abteilung erstellen, andere nur für ihre eigene
  const unit_id = req.user?.isRoot && req.body.unit_id ? req.body.unit_id : req.user?.departmentId;
  
  if (!unit_id) {
    return res.status(400).json({ error: 'Abteilung (unit_id) ist erforderlich' });
  }
  
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO categories (name, description, min_quantity, ops_code, zusatzentgelt, endo_today_link, unit_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, description, min_quantity || 0, ops_code || null, zusatzentgelt || null, endo_today_link || null, unit_id]
    );
    
    res.status(201).json({
      id: result.insertId,
      message: 'Kategorie erfolgreich erstellt'
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Kategorie mit diesem Namen existiert bereits in dieser Abteilung' });
    }
    console.error('Fehler beim Erstellen der Kategorie:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT Kategorie aktualisieren
router.put('/:id', async (req: Request, res: Response) => {
  const { name, description, min_quantity, ops_code, zusatzentgelt, endo_today_link } = req.body;
  
  try {
    // Non-Root User können nur Kategorien ihrer Abteilung bearbeiten
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [categoryCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM categories WHERE id = ? AND unit_id = ?',
        [req.params.id, req.user.departmentId]
      );
      if (categoryCheck.length === 0) {
        return res.status(403).json({ error: 'Kategorie nicht gefunden oder kein Zugriff' });
      }
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE categories SET name = ?, description = ?, min_quantity = ?, ops_code = ?, zusatzentgelt = ?, endo_today_link = ? WHERE id = ?',
      [name, description, min_quantity || 0, ops_code || null, zusatzentgelt || null, endo_today_link || null, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    }
    
    res.json({ message: 'Kategorie erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Kategorie:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Kategorie-Bestände (Summe aller Materialien pro Kategorie)
router.get('/stats/inventory', async (req: Request, res: Response) => {
  try {
    let query = `
      SELECT 
        c.id,
        c.name,
        c.description,
        c.min_quantity,
        c.unit_id,
        COALESCE(SUM(m.current_stock), 0) AS total_stock,
        COUNT(m.id) AS material_count,
        CASE 
          WHEN COALESCE(SUM(m.current_stock), 0) < c.min_quantity THEN 'low'
          WHEN COALESCE(SUM(m.current_stock), 0) = 0 THEN 'empty'
          ELSE 'ok'
        END AS stock_status
      FROM categories c
      LEFT JOIN materials m ON m.category_id = c.id AND m.active = TRUE
    `;
    const params: any[] = [];
    
    // Abteilungs-Filter für Non-Root User
    if (!req.user?.isRoot && req.user?.departmentId) {
      query += ' WHERE c.unit_id = ?';
      params.push(req.user.departmentId);
    } else if (!req.user?.isRoot && !req.user?.departmentId) {
      query += ' WHERE 1 = 0';
    }
    
    query += ' GROUP BY c.id, c.name, c.description, c.min_quantity, c.unit_id ORDER BY c.name';
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Kategorie-Bestände:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE Kategorie
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Non-Root User können nur Kategorien ihrer Abteilung löschen
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [categoryCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM categories WHERE id = ? AND unit_id = ?',
        [req.params.id, req.user.departmentId]
      );
      if (categoryCheck.length === 0) {
        return res.status(403).json({ error: 'Kategorie nicht gefunden oder kein Zugriff' });
      }
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM categories WHERE id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    }
    
    res.json({ message: 'Kategorie erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen der Kategorie:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
