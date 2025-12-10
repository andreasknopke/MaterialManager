import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { authenticate } from '../middleware/auth';
import { getDepartmentFilter } from '../utils/departmentFilter';

const router = Router();

// Alle Routes benötigen Authentifizierung
router.use(authenticate);

// GET alle Schränke
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('=== GET /api/cabinets ===');
    console.log('User:', { id: req.user?.id, isRoot: req.user?.isRoot, departmentId: req.user?.departmentId });
    
    const departmentFilter = getDepartmentFilter(req, 'cabinets');
    console.log('Department Filter:', departmentFilter);
    
    let query = 'SELECT * FROM cabinets WHERE active = TRUE';
    const params: any[] = [];
    
    if (departmentFilter.whereClause) {
      query += ` AND ${departmentFilter.whereClause}`;
      params.push(...departmentFilter.params);
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
    const departmentFilter = getDepartmentFilter(req, 'cabinets');
    let query = 'SELECT * FROM cabinets WHERE id = ?';
    const params: any[] = [req.params.id];
    
    if (departmentFilter.whereClause) {
      query += ` AND ${departmentFilter.whereClause}`;
      params.push(...departmentFilter.params);
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
    // Department-Validierung: Schrank muss zugänglich sein
    const departmentFilter = getDepartmentFilter(req, 'cabinets');
    if (departmentFilter.whereClause) {
      const [cabinets] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM cabinets WHERE id = ? AND ${departmentFilter.whereClause}`,
        [req.params.id, ...departmentFilter.params]
      );
      
      if (cabinets.length === 0) {
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
  const { name, location, description, capacity, unit_id } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }
  
  try {
    // Department-Validierung: unit_id muss Department des Users sein (oder beliebig für Root)
    let finalUnitId = unit_id;
    
    if (req.user?.departmentId && !req.user.isRoot) {
      // Department Admin/User können nur Schränke in ihrem Department erstellen
      if (unit_id && unit_id !== req.user.departmentId) {
        return res.status(403).json({ error: 'Sie können nur Schränke in Ihrem Department erstellen' });
      }
      finalUnitId = req.user.departmentId;
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO cabinets (name, location, description, capacity, unit_id) VALUES (?, ?, ?, ?, ?)',
      [name, location, description, capacity || 0, finalUnitId]
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
    // Department-Validierung: Schrank muss im erlaubten Department sein
    const departmentFilter = getDepartmentFilter(req, 'cabinets');
    if (departmentFilter.whereClause) {
      const [cabinets] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM cabinets WHERE id = ? AND ${departmentFilter.whereClause}`,
        [req.params.id, ...departmentFilter.params]
      );
      
      if (cabinets.length === 0) {
        return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
      }
    }
    
    // Department-Validierung: unit_id muss Department des Users sein (oder beliebig für Root)
    if (unit_id && req.user?.departmentId && !req.user.isRoot) {
      if (unit_id !== req.user.departmentId) {
        return res.status(403).json({ error: 'Sie können Schränke nur in Ihr Department verschieben' });
      }
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE cabinets 
       SET name = ?, location = ?, description = ?, capacity = ?, active = ?, unit_id = ?
       WHERE id = ?`,
      [name, location, description, capacity, active, unit_id, req.params.id]
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
    // Department-Validierung
    const departmentFilter = getDepartmentFilter(req, 'cabinets');
    if (departmentFilter.whereClause) {
      const [cabinets] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM cabinets WHERE id = ? AND ${departmentFilter.whereClause}`,
        [req.params.id, ...departmentFilter.params]
      );
      
      if (cabinets.length === 0) {
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
