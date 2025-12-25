import { Router, Request, Response } from 'express';
import pool, { getPoolForRequest } from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { authenticate } from '../middleware/auth';

const router = Router();

// Alle Routes benötigen Authentifizierung
router.use(authenticate);

// GET alle Firmen (gefiltert nach Abteilung)
router.get('/', async (req: Request, res: Response) => {
  try {
    const currentPool = getPoolForRequest(req);
    let query = 'SELECT c.*, u.name as unit_name FROM companies c LEFT JOIN units u ON c.unit_id = u.id';
    const params: any[] = [];
    const conditions: string[] = [];
    
    // Root sieht alle, andere nur ihre Abteilung
    if (!req.user?.isRoot && req.user?.departmentId) {
      conditions.push('c.unit_id = ?');
      params.push(req.user.departmentId);
    } else if (!req.user?.isRoot && !req.user?.departmentId) {
      conditions.push('1 = 0');
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY c.name';
    
    const [rows] = await currentPool.query<RowDataPacket[]>(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Firmen:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Firma nach ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const currentPool = getPoolForRequest(req);
    let query = 'SELECT c.*, u.name as unit_name FROM companies c LEFT JOIN units u ON c.unit_id = u.id WHERE c.id = ?';
    const params: any[] = [req.params.id];
    
    // Non-Root nur eigene Abteilung
    if (!req.user?.isRoot && req.user?.departmentId) {
      query += ' AND c.unit_id = ?';
      params.push(req.user.departmentId);
    }
    
    const [rows] = await currentPool.query<RowDataPacket[]>(query, params);
    
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
  
  // Root kann Abteilung wählen, andere bekommen automatisch ihre Abteilung
  const unit_id = req.user?.isRoot && req.body.unit_id ? req.body.unit_id : req.user?.departmentId;
  
  if (!unit_id) {
    return res.status(400).json({ error: 'Abteilung (unit_id) ist erforderlich' });
  }
  
  try {
    const currentPool = getPoolForRequest(req);
    const [result] = await currentPool.query<ResultSetHeader>(
      'INSERT INTO companies (name, contact_person, email, phone, address, unit_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, contact_person, email, phone, address, unit_id]
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
  const { name, contact_person, email, phone, address, unit_id } = req.body;
  
  try {
    const currentPool = getPoolForRequest(req);
    // Non-Root können nur eigene Firmen bearbeiten
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [check] = await currentPool.query<RowDataPacket[]>(
        'SELECT id FROM companies WHERE id = ? AND unit_id = ?',
        [req.params.id, req.user.departmentId]
      );
      if (check.length === 0) {
        return res.status(403).json({ error: 'Firma nicht gefunden oder kein Zugriff' });
      }
    }
    
    // Root kann Abteilung ändern
    let query: string;
    let params: any[];
    
    if (req.user?.isRoot && unit_id) {
      query = 'UPDATE companies SET name = ?, contact_person = ?, email = ?, phone = ?, address = ?, unit_id = ? WHERE id = ?';
      params = [name, contact_person, email, phone, address, unit_id, req.params.id];
    } else {
      query = 'UPDATE companies SET name = ?, contact_person = ?, email = ?, phone = ?, address = ? WHERE id = ?';
      params = [name, contact_person, email, phone, address, req.params.id];
    }
    
    const [result] = await currentPool.query<ResultSetHeader>(query, params);
    
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
    const currentPool = getPoolForRequest(req);
    // Non-Root können nur eigene Firmen löschen
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [check] = await currentPool.query<RowDataPacket[]>(
        'SELECT id FROM companies WHERE id = ? AND unit_id = ?',
        [req.params.id, req.user.departmentId]
      );
      if (check.length === 0) {
        return res.status(403).json({ error: 'Firma nicht gefunden oder kein Zugriff' });
      }
    }
    
    const [result] = await currentPool.query<ResultSetHeader>(
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
