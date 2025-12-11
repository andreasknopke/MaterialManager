import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { authenticate } from '../middleware/auth';

const router = Router();

// Alle Routes benötigen Authentifizierung
router.use(authenticate);

// GET alle Schränke
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('=== GET /api/cabinets ===');
    console.log('User:', { id: req.user?.id, isRoot: req.user?.isRoot, departmentId: req.user?.departmentId });
    
    let query = 'SELECT * FROM cabinets WHERE active = TRUE';
    const params: any[] = [];
    
    // Root sieht alle Schränke, andere nur ihr Department (cabinet)
    if (!req.user?.isRoot && req.user?.departmentId) {
      query += ' AND id = ?';
      params.push(req.user.departmentId);
      console.log('Department Filter applied: cabinet id =', req.user.departmentId);
    } else if (!req.user?.isRoot && !req.user?.departmentId) {
      // User ohne Department sieht nichts
      query += ' AND 1 = 0';
      console.log('User has no department - returning empty result');
    } else {
      console.log('Root user - no filter applied');
    }
    
    query += ' ORDER BY name';
    
    console.log('Query:', query);
    console.log('Params:', params);
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    console.log('Rows returned:', rows.length);
    res.json(rows);
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der Schränke:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Schrank nach ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    let query = 'SELECT * FROM cabinets WHERE id = ?';
    const params: any[] = [req.params.id];
    
    // Non-Root User können nur ihr eigenes Cabinet sehen
    if (!req.user?.isRoot && req.user?.departmentId) {
      query += ' AND id = ?';
      params.push(req.user.departmentId);
    }
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen des Schranks:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Materialien eines Schranks
router.get('/:id/materials', async (req: Request, res: Response) => {
  try {
    // Non-Root User können nur Materialien ihres eigenen Cabinets sehen
    if (!req.user?.isRoot && req.user?.departmentId && parseInt(req.params.id) !== req.user.departmentId) {
      return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
    }
    
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.*, c.name as category_name, co.name as company_name 
       FROM materials m
       LEFT JOIN categories c ON m.category_id = c.id
       LEFT JOIN companies co ON m.company_id = co.id
       WHERE m.cabinet_id = ? AND m.active = TRUE
       ORDER BY m.name`,
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Materialien:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST neuer Schrank
router.post('/', async (req: Request, res: Response) => {
  const { name, location, description, capacity } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }
  
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO cabinets (name, location, description, capacity) VALUES (?, ?, ?, ?)',
      [name, location, description, capacity || 0]
    );
    
    res.status(201).json({
      id: result.insertId,
      message: 'Schrank erfolgreich erstellt'
    });
  } catch (error) {
    console.error('Fehler beim Erstellen des Schranks:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT Schrank aktualisieren
router.put('/:id', async (req: Request, res: Response) => {
  const { name, location, description, capacity, active } = req.body;
  
  try {
    // Non-Root User können nur ihr eigenes Cabinet bearbeiten
    if (!req.user?.isRoot && req.user?.departmentId && parseInt(req.params.id) !== req.user.departmentId) {
      return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE cabinets 
       SET name = ?, location = ?, description = ?, capacity = ?, active = ?
       WHERE id = ?`,
      [name, location, description, capacity, active, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Schrank nicht gefunden' });
    }
    
    res.json({ message: 'Schrank erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Schranks:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE Schrank (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Non-Root User können nur ihr eigenes Cabinet löschen
    if (!req.user?.isRoot && req.user?.departmentId && parseInt(req.params.id) !== req.user.departmentId) {
      return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE cabinets SET active = FALSE WHERE id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Schrank nicht gefunden' });
    }
    
    res.json({ message: 'Schrank erfolgreich deaktiviert' });
  } catch (error) {
    console.error('Fehler beim Löschen des Schranks:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
