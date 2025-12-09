import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

const router = Router();

// GET alle Feldkonfigurationen
router.get('/', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM field_configurations WHERE active = TRUE ORDER BY display_order'
    );
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Feldkonfigurationen:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Feldkonfiguration nach ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM field_configurations WHERE id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Feldkonfiguration nicht gefunden' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen der Feldkonfiguration:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST neue Feldkonfiguration
router.post('/', async (req: Request, res: Response) => {
  const { field_name, field_label, field_type, is_required, display_order, options } = req.body;
  
  if (!field_name || !field_label || !field_type) {
    return res.status(400).json({ error: 'Feldname, Label und Typ sind erforderlich' });
  }
  
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO field_configurations 
       (field_name, field_label, field_type, is_required, display_order, options)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [field_name, field_label, field_type, is_required || false, display_order || 0, options]
    );
    
    res.status(201).json({
      id: result.insertId,
      message: 'Feldkonfiguration erfolgreich erstellt'
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Feldname existiert bereits' });
    }
    console.error('Fehler beim Erstellen der Feldkonfiguration:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT Feldkonfiguration aktualisieren
router.put('/:id', async (req: Request, res: Response) => {
  const { field_name, field_label, field_type, is_required, display_order, active, options } = req.body;
  
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE field_configurations 
       SET field_name = ?, field_label = ?, field_type = ?, 
           is_required = ?, display_order = ?, active = ?, options = ?
       WHERE id = ?`,
      [field_name, field_label, field_type, is_required, display_order, active, options, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Feldkonfiguration nicht gefunden' });
    }
    
    res.json({ message: 'Feldkonfiguration erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Feldkonfiguration:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE Feldkonfiguration (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE field_configurations SET active = FALSE WHERE id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Feldkonfiguration nicht gefunden' });
    }
    
    res.json({ message: 'Feldkonfiguration erfolgreich deaktiviert' });
  } catch (error) {
    console.error('Fehler beim Löschen der Feldkonfiguration:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
