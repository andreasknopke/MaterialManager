import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import { authenticate } from '../middleware/auth';
import { getDepartmentFilter } from '../utils/departmentFilter';

const router = Router();

// Alle Routes benötigen Authentifizierung
router.use(authenticate);

/**
 * GET /api/statistics/transactions
 * Alle Transaktionen (Ein-/Ausbuchungen) mit Filteroptionen
 * Root: Alle sehen, mit optionalem Department-Filter
 * Department User: Nur eigenes Department
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const { 
      startDate, 
      endDate, 
      type, 
      materialId, 
      unitId, // Department-Filter für Root
      limit = 100 
    } = req.query;

    let query = `
      SELECT 
        t.id,
        t.material_id,
        m.name AS material_name,
        m.article_number,
        t.transaction_type,
        t.quantity,
        t.previous_stock,
        t.new_stock,
        t.reference_number,
        t.notes,
        t.user_id,
        COALESCE(u.full_name, u.username, t.user_name) AS performed_by,
        t.transaction_date,
        m.unit_id,
        un.name AS unit_name,
        cab.name AS cabinet_name,
        cat.name AS category_name
      FROM material_transactions t
      JOIN materials m ON t.material_id = m.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN units un ON m.unit_id = un.id
      LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
      LEFT JOIN categories cat ON m.category_id = cat.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Department-Filter
    if (!req.user?.isRoot) {
      // Non-Root: Nur eigenes Department
      if (req.user?.departmentId) {
        query += ' AND m.unit_id = ?';
        params.push(req.user.departmentId);
      } else {
        return res.status(403).json({ error: 'Kein Department zugewiesen' });
      }
    } else if (unitId) {
      // Root mit optionalem Department-Filter
      query += ' AND m.unit_id = ?';
      params.push(unitId);
    }

    // Zeitraum-Filter
    if (startDate) {
      query += ' AND t.transaction_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND t.transaction_date <= ?';
      params.push(endDate + ' 23:59:59');
    }

    // Transaktionstyp-Filter
    if (type && ['in', 'out', 'adjustment', 'expired'].includes(type as string)) {
      query += ' AND t.transaction_type = ?';
      params.push(type);
    }

    // Material-Filter
    if (materialId) {
      query += ' AND t.material_id = ?';
      params.push(materialId);
    }

    query += ' ORDER BY t.transaction_date DESC';
    query += ` LIMIT ?`;
    params.push(parseInt(limit as string) || 100);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Transaktionen:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

/**
 * GET /api/statistics/summary
 * Zusammenfassende Statistiken für Dashboard/Übersicht
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, unitId } = req.query;

    // Base filter condition
    let unitFilter = '';
    const params: any[] = [];

    if (!req.user?.isRoot) {
      if (req.user?.departmentId) {
        unitFilter = 'm.unit_id = ?';
        params.push(req.user.departmentId);
      } else {
        return res.status(403).json({ error: 'Kein Department zugewiesen' });
      }
    } else if (unitId) {
      unitFilter = 'm.unit_id = ?';
      params.push(unitId);
    }

    // Zeitraum-Filter vorbereiten
    let dateFilter = '';
    if (startDate) {
      dateFilter += ' AND t.transaction_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND t.transaction_date <= ?';
      params.push(endDate + ' 23:59:59');
    }

    // Dupliziere params für die zweite Query
    const paramsForSecondQuery = [...params];

    // Hauptstatistiken
    const summaryQuery = `
      SELECT 
        COUNT(CASE WHEN t.transaction_type = 'in' THEN 1 END) AS total_in_count,
        COUNT(CASE WHEN t.transaction_type = 'out' THEN 1 END) AS total_out_count,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'in' THEN t.quantity ELSE 0 END), 0) AS total_in_quantity,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'out' THEN t.quantity ELSE 0 END), 0) AS total_out_quantity,
        COUNT(DISTINCT t.material_id) AS materials_affected,
        COUNT(DISTINCT t.user_id) AS active_users,
        COUNT(*) AS total_transactions
      FROM material_transactions t
      JOIN materials m ON t.material_id = m.id
      ${unitFilter ? `WHERE ${unitFilter}` : 'WHERE 1=1'}
      ${dateFilter}
    `;

    const [summaryRows] = await pool.query<RowDataPacket[]>(summaryQuery, params);

    // Top-Materialien nach Bewegung
    const topMaterialsQuery = `
      SELECT 
        m.id,
        m.name,
        m.article_number,
        COUNT(*) AS transaction_count,
        SUM(CASE WHEN t.transaction_type = 'in' THEN t.quantity ELSE 0 END) AS total_in,
        SUM(CASE WHEN t.transaction_type = 'out' THEN t.quantity ELSE 0 END) AS total_out
      FROM material_transactions t
      JOIN materials m ON t.material_id = m.id
      ${unitFilter ? `WHERE ${unitFilter}` : 'WHERE 1=1'}
      ${dateFilter}
      GROUP BY m.id, m.name, m.article_number
      ORDER BY transaction_count DESC
      LIMIT 10
    `;

    const [topMaterials] = await pool.query<RowDataPacket[]>(topMaterialsQuery, paramsForSecondQuery);

    res.json({
      summary: summaryRows[0] || {
        total_in_count: 0,
        total_out_count: 0,
        total_in_quantity: 0,
        total_out_quantity: 0,
        materials_affected: 0,
        active_users: 0,
        total_transactions: 0
      },
      topMaterials
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Statistik-Zusammenfassung:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

/**
 * GET /api/statistics/daily
 * Tägliche Statistiken für Charts
 */
router.get('/daily', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, unitId } = req.query;

    // Default: Letzte 30 Tage
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    
    let query = `
      SELECT 
        DATE(t.transaction_date) AS date,
        t.transaction_type,
        COUNT(*) AS transaction_count,
        SUM(t.quantity) AS total_quantity
      FROM material_transactions t
      JOIN materials m ON t.material_id = m.id
      WHERE t.transaction_date >= ?
    `;
    const params: any[] = [startDate || defaultStartDate.toISOString().split('T')[0]];

    if (endDate) {
      query += ' AND t.transaction_date <= ?';
      params.push(endDate + ' 23:59:59');
    }

    // Department-Filter
    if (!req.user?.isRoot) {
      if (req.user?.departmentId) {
        query += ' AND m.unit_id = ?';
        params.push(req.user.departmentId);
      } else {
        return res.status(403).json({ error: 'Kein Department zugewiesen' });
      }
    } else if (unitId) {
      query += ' AND m.unit_id = ?';
      params.push(unitId);
    }

    query += ' GROUP BY DATE(t.transaction_date), t.transaction_type';
    query += ' ORDER BY date ASC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der täglichen Statistiken:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

/**
 * GET /api/statistics/monthly
 * Monatliche Übersicht
 */
router.get('/monthly', async (req: Request, res: Response) => {
  try {
    const { year, unitId } = req.query;
    const targetYear = year || new Date().getFullYear();

    let query = `
      SELECT 
        YEAR(t.transaction_date) AS year,
        MONTH(t.transaction_date) AS month,
        SUM(CASE WHEN t.transaction_type = 'in' THEN t.quantity ELSE 0 END) AS total_in,
        SUM(CASE WHEN t.transaction_type = 'out' THEN t.quantity ELSE 0 END) AS total_out,
        COUNT(CASE WHEN t.transaction_type = 'in' THEN 1 END) AS in_count,
        COUNT(CASE WHEN t.transaction_type = 'out' THEN 1 END) AS out_count,
        COUNT(DISTINCT t.material_id) AS materials_affected
      FROM material_transactions t
      JOIN materials m ON t.material_id = m.id
      WHERE YEAR(t.transaction_date) = ?
    `;
    const params: any[] = [targetYear];

    // Department-Filter
    if (!req.user?.isRoot) {
      if (req.user?.departmentId) {
        query += ' AND m.unit_id = ?';
        params.push(req.user.departmentId);
      } else {
        return res.status(403).json({ error: 'Kein Department zugewiesen' });
      }
    } else if (unitId) {
      query += ' AND m.unit_id = ?';
      params.push(unitId);
    }

    query += ' GROUP BY YEAR(t.transaction_date), MONTH(t.transaction_date)';
    query += ' ORDER BY year, month';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der monatlichen Statistiken:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

/**
 * GET /api/statistics/material-stats
 * Statistiken pro Material (Höchst-/Tiefststände, etc.)
 */
router.get('/material-stats', async (req: Request, res: Response) => {
  try {
    const { unitId, sortBy = 'transaction_count', order = 'desc' } = req.query;

    let query = `
      SELECT 
        m.id AS material_id,
        m.name AS material_name,
        m.article_number,
        m.current_stock,
        m.min_stock,
        m.unit_id,
        un.name AS unit_name,
        cab.name AS cabinet_name,
        cat.name AS category_name,
        COALESCE((SELECT MAX(new_stock) FROM material_transactions WHERE material_id = m.id), m.current_stock) AS max_stock_ever,
        COALESCE((SELECT MIN(new_stock) FROM material_transactions WHERE material_id = m.id AND new_stock >= 0), m.current_stock) AS min_stock_ever,
        COALESCE((SELECT SUM(quantity) FROM material_transactions WHERE material_id = m.id AND transaction_type = 'in'), 0) AS total_in,
        COALESCE((SELECT SUM(quantity) FROM material_transactions WHERE material_id = m.id AND transaction_type = 'out'), 0) AS total_out,
        (SELECT COUNT(*) FROM material_transactions WHERE material_id = m.id) AS transaction_count,
        (SELECT transaction_date FROM material_transactions WHERE material_id = m.id ORDER BY transaction_date DESC LIMIT 1) AS last_transaction_date
      FROM materials m
      LEFT JOIN units un ON m.unit_id = un.id
      LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
      LEFT JOIN categories cat ON m.category_id = cat.id
      WHERE m.active = TRUE
    `;
    const params: any[] = [];

    // Department-Filter
    if (!req.user?.isRoot) {
      if (req.user?.departmentId) {
        query += ' AND m.unit_id = ?';
        params.push(req.user.departmentId);
      } else {
        return res.status(403).json({ error: 'Kein Department zugewiesen' });
      }
    } else if (unitId) {
      query += ' AND m.unit_id = ?';
      params.push(unitId);
    }

    // Sortierung
    const validSortColumns = ['material_name', 'current_stock', 'transaction_count', 'total_in', 'total_out', 'last_transaction_date'];
    const sortColumn = validSortColumns.includes(sortBy as string) ? sortBy : 'transaction_count';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ${sortColumn} ${sortOrder}`;

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Material-Statistiken:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

/**
 * GET /api/statistics/user-activity
 * Benutzeraktivität (wer hat wie viel gebucht)
 */
router.get('/user-activity', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, unitId } = req.query;

    let query = `
      SELECT 
        t.user_id,
        COALESCE(u.full_name, u.username, t.user_name, 'Unbekannt') AS user_name,
        COUNT(*) AS total_transactions,
        COUNT(CASE WHEN t.transaction_type = 'in' THEN 1 END) AS in_count,
        COUNT(CASE WHEN t.transaction_type = 'out' THEN 1 END) AS out_count,
        SUM(CASE WHEN t.transaction_type = 'in' THEN t.quantity ELSE 0 END) AS total_in_quantity,
        SUM(CASE WHEN t.transaction_type = 'out' THEN t.quantity ELSE 0 END) AS total_out_quantity,
        MIN(t.transaction_date) AS first_transaction,
        MAX(t.transaction_date) AS last_transaction
      FROM material_transactions t
      JOIN materials m ON t.material_id = m.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Zeitraum-Filter
    if (startDate) {
      query += ' AND t.transaction_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND t.transaction_date <= ?';
      params.push(endDate + ' 23:59:59');
    }

    // Department-Filter
    if (!req.user?.isRoot) {
      if (req.user?.departmentId) {
        query += ' AND m.unit_id = ?';
        params.push(req.user.departmentId);
      } else {
        return res.status(403).json({ error: 'Kein Department zugewiesen' });
      }
    } else if (unitId) {
      query += ' AND m.unit_id = ?';
      params.push(unitId);
    }

    query += ' GROUP BY t.user_id, COALESCE(u.full_name, u.username, t.user_name, \'Unbekannt\')';
    query += ' ORDER BY total_transactions DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzeraktivität:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
