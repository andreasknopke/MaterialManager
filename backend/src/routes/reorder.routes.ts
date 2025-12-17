import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { authenticate } from '../middleware/auth';
import { getDepartmentFilter } from '../utils/departmentFilter';

const router = Router();

router.use(authenticate);

// GET Materialausgänge nach Zeitraum
// Aggregiert nach Produkt (GTIN) mit Gesamtbestand
router.get('/stock-outs', async (req: Request, res: Response) => {
  try {
    const { period } = req.query; // 'today', '3days', 'week', 'month'
    
    // Zeitraum-Filter berechnen
    let dateFilter = '';
    switch (period) {
      case 'today':
        dateFilter = 'DATE(mt.transaction_date) = CURDATE()';
        break;
      case '3days':
        dateFilter = 'mt.transaction_date >= DATE_SUB(NOW(), INTERVAL 3 DAY)';
        break;
      case 'week':
        dateFilter = 'mt.transaction_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case 'month':
        dateFilter = 'mt.transaction_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
      default:
        dateFilter = 'DATE(mt.transaction_date) = CURDATE()';
    }
    
    // Department-Filter
    const departmentFilter = getDepartmentFilter(req, 'm');
    
    // Aggregierte Ausgänge pro Produkt (GTIN)
    let query = `
      SELECT 
        p.id as product_id,
        p.gtin,
        p.name as product_name,
        co.name as company_name,
        CAST(SUM(ABS(mt.quantity)) AS SIGNED) as total_out,
        COUNT(DISTINCT mt.id) as transaction_count,
        CAST((SELECT COALESCE(SUM(m2.current_stock), 0) 
         FROM materials m2 
         WHERE m2.product_id = p.id AND m2.active = TRUE) AS SIGNED) as current_total_stock,
        GROUP_CONCAT(DISTINCT m.lot_number ORDER BY m.lot_number SEPARATOR ', ') as lot_numbers,
        MIN(m.expiry_date) as earliest_expiry,
        MAX(mt.transaction_date) as last_transaction,
        p.shaft_length,
        p.device_length,
        p.device_diameter,
        p.french_size,
        p.size
      FROM material_transactions mt
      JOIN materials m ON mt.material_id = m.id
      JOIN products p ON m.product_id = p.id
      LEFT JOIN companies co ON p.company_id = co.id
      WHERE mt.transaction_type = 'out'
        AND ${dateFilter}
    `;
    
    const params: any[] = [];
    
    if (departmentFilter.whereClause) {
      query += ` AND ${departmentFilter.whereClause}`;
      params.push(...departmentFilter.params);
    }
    
    query += `
      GROUP BY p.id, p.gtin, p.name, co.name, p.shaft_length, p.device_length, p.device_diameter, p.french_size, p.size
      ORDER BY total_out DESC, p.name
    `;
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    
    // Sicherstellen dass total_out numerisch ist
    const totalQuantity = rows.reduce((sum: number, r: any) => sum + (Number(r.total_out) || 0), 0);
    
    res.json({
      period,
      stockOuts: rows,
      totalItems: rows.length,
      totalQuantity
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Materialausgänge:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Einzelne Transaktionen für ein Produkt (für Detail-Ansicht)
router.get('/stock-outs/:productId/transactions', async (req: Request, res: Response) => {
  try {
    const { period } = req.query;
    const { productId } = req.params;
    
    let dateFilter = '';
    switch (period) {
      case 'today':
        dateFilter = 'DATE(mt.transaction_date) = CURDATE()';
        break;
      case '3days':
        dateFilter = 'mt.transaction_date >= DATE_SUB(NOW(), INTERVAL 3 DAY)';
        break;
      case 'week':
        dateFilter = 'mt.transaction_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case 'month':
        dateFilter = 'mt.transaction_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
      default:
        dateFilter = 'DATE(mt.transaction_date) = CURDATE()';
    }
    
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        mt.id,
        mt.quantity,
        mt.transaction_date,
        mt.notes,
        mt.user_name,
        m.lot_number,
        m.expiry_date,
        p.gtin,
        p.name as product_name,
        c.name as cabinet_name
      FROM material_transactions mt
      JOIN materials m ON mt.material_id = m.id
      JOIN products p ON m.product_id = p.id
      LEFT JOIN cabinets c ON m.cabinet_id = c.id
      WHERE mt.transaction_type = 'out'
        AND p.id = ?
        AND ${dateFilter}
      ORDER BY mt.transaction_date DESC
    `, [productId]);
    
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Transaktionen:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// ==================== REORDER HISTORY ENDPOINTS ====================

// POST - Material als nachbestellt markieren
router.post('/mark-ordered', async (req: Request, res: Response) => {
  try {
    const { product_id, gtin, product_name, quantity_ordered, notes } = req.body;
    
    if (!product_id || !product_name) {
      return res.status(400).json({ error: 'product_id und product_name sind erforderlich' });
    }
    
    const userId = req.user?.id || null;
    const userName = req.user?.fullName || req.user?.username || 'Unbekannt';
    
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO reorder_history (product_id, gtin, product_name, quantity_ordered, ordered_by, ordered_by_name, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [product_id, gtin || null, product_name, quantity_ordered || 1, userId, userName, notes || null]
    );
    
    res.status(201).json({
      id: result.insertId,
      message: 'Material als nachbestellt markiert'
    });
  } catch (error) {
    console.error('Fehler beim Markieren als nachbestellt:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET - Bestellhistorie abrufen
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { status, search, period } = req.query;
    
    let query = `
      SELECT 
        rh.*,
        p.company_id,
        co.name as company_name,
        p.shaft_length,
        p.device_length,
        p.device_diameter,
        p.french_size
      FROM reorder_history rh
      LEFT JOIN products p ON rh.product_id = p.id
      LEFT JOIN companies co ON p.company_id = co.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    // Status-Filter
    if (status && status !== 'all') {
      query += ` AND rh.status = ?`;
      params.push(status);
    }
    
    // Suchfilter
    if (search) {
      query += ` AND (rh.product_name LIKE ? OR rh.gtin LIKE ? OR co.name LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    // Zeitraum-Filter
    if (period) {
      switch (period) {
        case 'today':
          query += ` AND DATE(rh.ordered_at) = CURDATE()`;
          break;
        case 'week':
          query += ` AND rh.ordered_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
          break;
        case 'month':
          query += ` AND rh.ordered_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
          break;
        case 'year':
          query += ` AND rh.ordered_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)`;
          break;
      }
    }
    
    query += ` ORDER BY rh.ordered_at DESC`;
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Bestellhistorie:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT - Bestellung-Status aktualisieren (z.B. als empfangen markieren)
router.put('/history/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status ist erforderlich' });
    }
    
    const receivedAt = status === 'received' ? 'NOW()' : 'NULL';
    
    await pool.query(
      `UPDATE reorder_history SET status = ?, notes = COALESCE(?, notes), received_at = ${receivedAt} WHERE id = ?`,
      [status, notes || null, id]
    );
    
    res.json({ message: 'Status aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Status:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE - Bestellung aus Historie löschen
router.delete('/history/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM reorder_history WHERE id = ?', [id]);
    
    res.json({ message: 'Eintrag gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET - Prüfen ob Produkt bereits als nachbestellt markiert ist (noch offen)
router.get('/is-ordered/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, ordered_at, ordered_by_name FROM reorder_history 
       WHERE product_id = ? AND status = 'ordered' 
       ORDER BY ordered_at DESC LIMIT 1`,
      [productId]
    );
    
    if (rows.length > 0) {
      res.json({ isOrdered: true, order: rows[0] });
    } else {
      res.json({ isOrdered: false });
    }
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
