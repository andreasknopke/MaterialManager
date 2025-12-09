import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

const router = Router();

// GET alle Firmen
router.get('/', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM companies ORDER BY name'
    );
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Firmen:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Firma nach ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM companies WHERE id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Firma nicht gefunden' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen der Firma:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST neue Firma
router.post('/', async (req: Request, res: Response) => {
  const { name, contact_person, email, phone, address } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }
  
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO companies (name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?)',
      [name, contact_person, email, phone, address]
    );
    
    res.status(201).json({
      id: result.insertId,
      message: 'Firma erfolgreich erstellt'
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Firma existiert bereits' });
    }
    console.error('Fehler beim Erstellen der Firma:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT Firma aktualisieren
router.put('/:id', async (req: Request, res: Response) => {
  const { name, contact_person, email, phone, address } = req.body;
  
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE companies SET name = ?, contact_person = ?, email = ?, phone = ?, address = ? WHERE id = ?',
      [name, contact_person, email, phone, address, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Firma nicht gefunden' });
    }
    
    res.json({ message: 'Firma erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Firma:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE Firma
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM companies WHERE id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Firma nicht gefunden' });
    }
    
    res.json({ message: 'Firma erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen der Firma:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
