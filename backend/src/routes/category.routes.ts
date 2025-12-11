import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { authenticate } from '../middleware/auth';

const router = Router();

// Alle Routes benötigen Authentifizierung
router.use(authenticate);

// GET alle Kategorien (gefiltert nach Department)
router.get('/', async (req: Request, res: Response) => {
  try {
    let query = 'SELECT c.*, u.name as department_name FROM categories c LEFT JOIN units u ON c.department_id = u.id';
    const params: any[] = [];
    const conditions: string[] = [];
    
    // Root sieht alle, andere nur ihr Department
    if (!req.user?.isRoot && req.user?.departmentId) {
      conditions.push('c.department_id = ?');
      params.push(req.user.departmentId);
    } else if (!req.user?.isRoot && !req.user?.departmentId) {
      conditions.push('1 = 0');
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY c.name';
    
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
    let query = 'SELECT c.*, u.name as department_name FROM categories c LEFT JOIN units u ON c.department_id = u.id WHERE c.id = ?';
    const params: any[] = [req.params.id];
    
    // Non-Root nur eigenes Department
    if (!req.user?.isRoot && req.user?.departmentId) {
      query += ' AND c.department_id = ?';
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
  const { name, description, min_quantity } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }
  
  // Root kann Department wählen, andere bekommen automatisch ihr Department
  const department_id = req.user?.isRoot && req.body.department_id ? req.body.department_id : req.user?.departmentId;
  
  if (!department_id) {
    return res.status(400).json({ error: 'Department ID ist erforderlich' });
  }
  
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO categories (name, description, min_quantity, department_id) VALUES (?, ?, ?, ?)',
      [name, description, min_quantity || 0, department_id]
    );
    
    res.status(201).json({
      id: result.insertId,
      message: 'Kategorie erfolgreich erstellt'
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Kategorie existiert bereits' });
    }
    console.error('Fehler beim Erstellen der Kategorie:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT Kategorie aktualisieren
router.put('/:id', async (req: Request, res: Response) => {
  const { name, description, min_quantity, department_id } = req.body;
  
  try {
    // Non-Root können nur eigene Kategorien bearbeiten
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [check] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM categories WHERE id = ? AND department_id = ?',
        [req.params.id, req.user.departmentId]
      );
      if (check.length === 0) {
        return res.status(403).json({ error: 'Kategorie nicht gefunden oder kein Zugriff' });
      }
    }
    
    // Root kann Department ändern
    let query: string;
    let params: any[];
    
    if (req.user?.isRoot && department_id) {
      query = 'UPDATE categories SET name = ?, description = ?, min_quantity = ?, department_id = ? WHERE id = ?';
      params = [name, description, min_quantity || 0, department_id, req.params.id];
    } else {
      query = 'UPDATE categories SET name = ?, description = ?, min_quantity = ? WHERE id = ?';
      params = [name, description, min_quantity || 0, req.params.id];
    }
    
    const [result] = await pool.query<ResultSetHeader>(query, params);
    
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
        c.department_id,
        u.name as department_name,
        COALESCE(SUM(m.current_stock), 0) AS total_stock,
        COUNT(m.id) AS material_count,
        CASE 
          WHEN COALESCE(SUM(m.current_stock), 0) < c.min_quantity THEN 'low'
          WHEN COALESCE(SUM(m.current_stock), 0) = 0 THEN 'empty'
          ELSE 'ok'
        END AS stock_status
      FROM categories c
      LEFT JOIN units u ON c.department_id = u.id
      LEFT JOIN materials m ON m.category_id = c.id AND m.active = TRUE`;
    
    const params: any[] = [];
    
    // Department-Filter
    if (!req.user?.isRoot && req.user?.departmentId) {
      query += ' WHERE c.department_id = ?';
      params.push(req.user.departmentId);
    }
    
    query += ` GROUP BY c.id, c.name, c.description, c.min_quantity, c.department_id, u.name
      ORDER BY c.name`;
    
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
    // Non-Root können nur eigene Kategorien löschen
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [check] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM categories WHERE id = ? AND department_id = ?',
        [req.params.id, req.user.departmentId]
      );
      if (check.length === 0) {
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
