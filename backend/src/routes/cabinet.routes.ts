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
    
    let query = 'SELECT c.*, u.name as department_name FROM cabinets c LEFT JOIN units u ON c.unit_id = u.id';
    const params: any[] = [];
    const conditions: string[] = [];
    
    // Root sieht alle Schränke (auch inaktive), andere nur ihre Department-Schränke (nur aktive)
    if (!req.user?.isRoot && req.user?.departmentId) {
      conditions.push('c.active = TRUE');
      conditions.push('c.unit_id = ?');
      params.push(req.user.departmentId);
      console.log('Department Filter applied: unit_id =', req.user.departmentId);
    } else if (!req.user?.isRoot && !req.user?.departmentId) {
      // User ohne Department sieht nichts
      conditions.push('1 = 0');
      console.log('User has no department - returning empty result');
    } else {
      // Root sieht alles, auch inaktive Schränke
      console.log('Root user - no filter applied, showing all cabinets');
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY c.name';
    
    console.log('Final query:', query);
    console.log('Query params:', params);
    
    console.log('Executing query...');
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    console.log('Query executed successfully');
    console.log('Rows returned:', rows.length);
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der Schränke:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Schrank nach ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    let query = 'SELECT c.*, u.name as department_name FROM cabinets c LEFT JOIN units u ON c.unit_id = u.id WHERE c.id = ?';
    const params: any[] = [req.params.id];
    
    // Non-Root User können nur Schränke ihres Departments sehen
    if (!req.user?.isRoot && req.user?.departmentId) {
      query += ' AND c.unit_id = ?';
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
    // Non-Root User können nur Materialien aus Schränken ihres Departments sehen
    if (!req.user?.isRoot && req.user?.departmentId) {
      // Prüfe ob der Schrank zum Department des Users gehört
      const [cabinetCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cabinets WHERE id = ? AND unit_id = ?',
        [req.params.id, req.user.departmentId]
      );
      if (cabinetCheck.length === 0) {
        return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
      }
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
  
  // Root kann Department wählen, andere bekommen automatisch ihr Department
  const unit_id = req.user?.isRoot && req.body.unit_id ? req.body.unit_id : req.user?.departmentId;
  
  if (!unit_id) {
    return res.status(400).json({ error: 'Department ID ist erforderlich' });
  }
  
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO cabinets (name, location, description, capacity, unit_id) VALUES (?, ?, ?, ?, ?)',
      [name, location, description, capacity || 0, unit_id]
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
  const { name, location, description, capacity, active, unit_id } = req.body;
  
  try {
    // Non-Root User können nur Schränke ihres Departments bearbeiten
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [cabinetCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cabinets WHERE id = ? AND unit_id = ?',
        [req.params.id, req.user.departmentId]
      );
      if (cabinetCheck.length === 0) {
        return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
      }
    }
    
    // Root kann Department ändern, andere nicht
    let query: string;
    let params: any[];
    
    if (req.user?.isRoot && unit_id) {
      query = `UPDATE cabinets SET name = ?, location = ?, description = ?, capacity = ?, active = ?, unit_id = ? WHERE id = ?`;
      params = [name, location, description, capacity, active, unit_id, req.params.id];
    } else {
      query = `UPDATE cabinets SET name = ?, location = ?, description = ?, capacity = ?, active = ? WHERE id = ?`;
      params = [name, location, description, capacity, active, req.params.id];
    }
    
    const [result] = await pool.query<ResultSetHeader>(query, params);
    
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
    // Non-Root User können nur Schränke ihres Departments löschen
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [cabinetCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cabinets WHERE id = ? AND unit_id = ?',
        [req.params.id, req.user.departmentId]
      );
      if (cabinetCheck.length === 0) {
        return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
      }
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
