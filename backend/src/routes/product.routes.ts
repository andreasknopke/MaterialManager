import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { authenticate } from '../middleware/auth';

const router = Router();

// Alle Routes benötigen Authentifizierung
router.use(authenticate);

// GET alle Produkte (mit Aggregat-Daten)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, company_id } = req.query;
    
    let query = `
      SELECT p.*, 
             co.name as company_name,
             s.name as shape_name,
             (SELECT COUNT(*) FROM materials m WHERE m.product_id = p.id AND m.active = TRUE) as materials_count,
             (SELECT SUM(m.current_stock) FROM materials m WHERE m.product_id = p.id AND m.active = TRUE) as total_stock
      FROM products p
      LEFT JOIN companies co ON p.company_id = co.id
      LEFT JOIN shapes s ON p.shape_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (search) {
      query += ` AND (p.name LIKE ? OR p.gtin LIKE ? OR p.description LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }
    
    if (company_id) {
      query += ` AND p.company_id = ?`;
      params.push(company_id);
    }
    
    query += ` ORDER BY p.name`;
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Produkte:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Produkt nach ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.*, 
              co.name as company_name,
              s.name as shape_name
       FROM products p
       LEFT JOIN companies co ON p.company_id = co.id
       LEFT JOIN shapes s ON p.shape_id = s.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }
    
    // Material-Instanzen dieses Produkts abrufen
    const [materials] = await pool.query<RowDataPacket[]>(
      `SELECT m.id, m.lot_number, m.expiry_date, m.current_stock, m.is_consignment,
              c.name as cabinet_name, cat.name as category_name
       FROM materials m
       LEFT JOIN cabinets c ON m.cabinet_id = c.id
       LEFT JOIN categories cat ON m.category_id = cat.id
       WHERE m.product_id = ? AND m.active = TRUE
       ORDER BY m.expiry_date ASC`,
      [req.params.id]
    );
    
    res.json({
      ...rows[0],
      materials: materials
    });
  } catch (error) {
    console.error('Fehler beim Abrufen des Produkts:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Produkt nach GTIN
router.get('/gtin/:gtin', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.*, 
              co.name as company_name,
              s.name as shape_name
       FROM products p
       LEFT JOIN companies co ON p.company_id = co.id
       LEFT JOIN shapes s ON p.shape_id = s.id
       WHERE p.gtin = ?`,
      [req.params.gtin]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen des Produkts:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST neues Produkt
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      gtin, name, description, size, company_id, shape_id,
      shaft_length, device_length, device_diameter, french_size,
      guidewire_acceptance, cost, notes
    } = req.body;
    
    if (!gtin || !name) {
      return res.status(400).json({ error: 'GTIN und Name sind erforderlich' });
    }
    
    // Prüfen ob GTIN bereits existiert
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM products WHERE gtin = ?',
      [gtin]
    );
    
    if (existing.length > 0) {
      return res.status(409).json({ 
        error: 'Produkt mit dieser GTIN existiert bereits',
        existingId: existing[0].id
      });
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO products 
       (gtin, name, description, size, company_id, shape_id,
        shaft_length, device_length, device_diameter, french_size,
        guidewire_acceptance, cost, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [gtin, name, description, size, company_id, shape_id,
       shaft_length, device_length, device_diameter, french_size,
       guidewire_acceptance, cost, notes]
    );
    
    res.status(201).json({
      id: result.insertId,
      message: 'Produkt erfolgreich erstellt'
    });
  } catch (error) {
    console.error('Fehler beim Erstellen des Produkts:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT Produkt aktualisieren
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const {
      name, description, size, company_id, shape_id,
      shaft_length, device_length, device_diameter, french_size,
      guidewire_acceptance, cost, notes
    } = req.body;
    
    // GTIN kann nicht geändert werden (unique identifier)
    await pool.query(
      `UPDATE products SET
        name = ?, description = ?, size = ?, company_id = ?, shape_id = ?,
        shaft_length = ?, device_length = ?, device_diameter = ?, french_size = ?,
        guidewire_acceptance = ?, cost = ?, notes = ?
       WHERE id = ?`,
      [name, description, size, company_id, shape_id,
       shaft_length, device_length, device_diameter, french_size,
       guidewire_acceptance, cost, notes, req.params.id]
    );
    
    res.json({ message: 'Produkt aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Produkts:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE Produkt (nur wenn keine Materialien verknüpft)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Prüfen ob noch Materialien verknüpft sind
    const [materials] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM materials WHERE product_id = ?',
      [req.params.id]
    );
    
    if (materials[0].count > 0) {
      return res.status(400).json({ 
        error: `Produkt kann nicht gelöscht werden. Es sind noch ${materials[0].count} Materialien verknüpft.`
      });
    }
    
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Produkt gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Produkts:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
