import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
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

export default router;
