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
    
    let query = 'SELECT c.*, d.name as department_name FROM cabinets c LEFT JOIN departments d ON c.department_id = d.id WHERE c.active = TRUE';
    const params: any[] = [];
    
    // Root sieht alle Schränke, andere nur ihre Department-Schränke
    if (!req.user?.isRoot && req.user?.departmentId) {
      query += ' AND c.department_id = ?';
      params.push(req.user.departmentId);
      console.log('Department Filter applied: department_id =', req.user.departmentId);
    } else if (!req.user?.isRoot && !req.user?.departmentId) {
      // User ohne Department sieht nichts
      query += ' AND 1 = 0';
      console.log('User has no department - returning empty result');
    } else {
      console.log('Root user - no filter applied');
    }
    
    query += ' ORDER BY name';
    
    console.log('Final query:', query);
    console.log('Query params:', params);
    
    console.log('Executing query...');
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    console.log('Query executed successfully');
    console.log('Rows returned:', rows.length);
    console.log('Rows data:', JSON.stringify(rows));
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der Schränke:', error);
    console.error('Error details:', JSON.stringify(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Schrank nach ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    let query = 'SELECT c.*, d.name as department_name FROM cabinets c LEFT JOIN departments d ON c.department_id = d.id WHERE c.id = ?';
    const params: any[] = [req.params.id];
    
    // Non-Root User können nur Schränke ihres Departments sehen
    if (!req.user?.isRoot && req.user?.departmentId) {
      query += ' AND c.department_id = ?';
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
        'SELECT id FROM cabinets WHERE id = ? AND department_id = ?',
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
  
  // Department Admin kann nur Schränke für sein eigenes Department erstellen
  const department_id = req.user?.isRoot && req.body.department_id ? req.body.department_id : req.user?.departmentId;
  
  if (!department_id) {
    return res.status(400).json({ error: 'Department ID ist erforderlich' });
  }
  
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO cabinets (name, location, description, capacity, department_id) VALUES (?, ?, ?, ?, ?)',
      [name, location, description, capacity || 0, department_id]
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
    // Non-Root User können nur Schränke ihres Departments bearbeiten
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [cabinetCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cabinets WHERE id = ? AND department_id = ?',
        [req.params.id, req.user.departmentId]
      );
      if (cabinetCheck.length === 0) {
        return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
      }
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
