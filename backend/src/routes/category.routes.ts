import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

const router = Router();

// GET alle Kategorien
router.get('/', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM categories ORDER BY name'
    );
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Kategorien:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Kategorie nach ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM categories WHERE id = ?',
      [req.params.id]
    );
    
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
  const { name, description, min_quantity, ops_code, zusatzentgelt } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }
  
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO categories (name, description, min_quantity, ops_code, zusatzentgelt) VALUES (?, ?, ?, ?, ?)',
      [name, description, min_quantity || 0, ops_code || null, zusatzentgelt || null]
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
  const { name, description, min_quantity, ops_code, zusatzentgelt } = req.body;
  
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE categories SET name = ?, description = ?, min_quantity = ?, ops_code = ?, zusatzentgelt = ? WHERE id = ?',
      [name, description, min_quantity || 0, ops_code || null, zusatzentgelt || null, req.params.id]
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
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.min_quantity,
        COALESCE(SUM(m.current_stock), 0) AS total_stock,
        COUNT(m.id) AS material_count,
        CASE 
          WHEN COALESCE(SUM(m.current_stock), 0) < c.min_quantity THEN 'low'
          WHEN COALESCE(SUM(m.current_stock), 0) = 0 THEN 'empty'
          ELSE 'ok'
        END AS stock_status
      FROM categories c
      LEFT JOIN materials m ON m.category_id = c.id AND m.active = TRUE
      GROUP BY c.id, c.name, c.description, c.min_quantity
      ORDER BY c.name
    `);
    
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Kategorie-Bestände:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE Kategorie
router.delete('/:id', async (req: Request, res: Response) => {
  try {
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
