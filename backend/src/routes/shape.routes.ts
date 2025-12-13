import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { authenticate } from '../middleware/auth';

const router = Router();

// Alle Routes benötigen Authentifizierung
router.use(authenticate);

// GET alle Shapes
router.get('/', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM shapes WHERE active = TRUE ORDER BY sort_order, name'
    );
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Shapes:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET alle Shapes (inkl. inaktive) - für Admin
router.get('/all', async (req: Request, res: Response) => {
  try {
    // Admins (inkl. Department-Admin) dürfen alle sehen
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM shapes ORDER BY sort_order, name'
    );
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen aller Shapes:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST neuen Shape erstellen
router.post('/', async (req: Request, res: Response) => {
  try {
    // Admins (inkl. Department-Admin) dürfen erstellen
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    
    const { name, description, sort_order } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO shapes (name, description, sort_order) VALUES (?, ?, ?)',
      [name, description || null, sort_order || 0]
    );
    
    res.status(201).json({
      id: result.insertId,
      message: 'Shape erfolgreich erstellt'
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ein Shape mit diesem Namen existiert bereits' });
    }
    console.error('Fehler beim Erstellen des Shapes:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT Shape aktualisieren
router.put('/:id', async (req: Request, res: Response) => {
  try {
    // Admins (inkl. Department-Admin) dürfen bearbeiten
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    
    const { name, description, sort_order, active } = req.body;
    
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE shapes SET name = ?, description = ?, sort_order = ?, active = ? WHERE id = ?',
      [name, description || null, sort_order || 0, active !== false, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Shape nicht gefunden' });
    }
    
    res.json({ message: 'Shape erfolgreich aktualisiert' });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ein Shape mit diesem Namen existiert bereits' });
    }
    console.error('Fehler beim Aktualisieren des Shapes:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE Shape löschen (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Admins (inkl. Department-Admin) dürfen löschen
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE shapes SET active = FALSE WHERE id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Shape nicht gefunden' });
    }
    
    res.json({ message: 'Shape erfolgreich deaktiviert' });
  } catch (error) {
    console.error('Fehler beim Löschen des Shapes:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
