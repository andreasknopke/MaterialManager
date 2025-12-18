import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// Alle Routes benötigen Authentifizierung und Admin-Rechte
router.use(authenticate);
router.use(requireAdmin);

// GET /api/audit-logs - Alle Audit-Logs abrufen
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      action, 
      entity_type, 
      user_id,
      start_date,
      end_date,
      search
    } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    let whereClause = '1=1';
    const params: any[] = [];
    
    if (action) {
      whereClause += ' AND al.action = ?';
      params.push(action);
    }
    
    if (entity_type) {
      whereClause += ' AND al.entity_type = ?';
      params.push(entity_type);
    }
    
    if (user_id) {
      whereClause += ' AND al.user_id = ?';
      params.push(user_id);
    }
    
    if (start_date) {
      whereClause += ' AND al.created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      whereClause += ' AND al.created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }
    
    if (search) {
      whereClause += ' AND (al.entity_name LIKE ? OR al.username LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    // Gesamtanzahl für Pagination
    const [countResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM audit_logs al WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    
    // Logs abrufen
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT al.*, u.display_name as user_display_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );
    
    res.json({
      data: rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Audit-Logs:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET /api/audit-logs/stats - Statistiken für Dashboard
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Aktionen der letzten 24 Stunden
    const [last24h] = await pool.query<RowDataPacket[]>(`
      SELECT action, COUNT(*) as count 
      FROM audit_logs 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY action
    `);
    
    // Aktionen der letzten 7 Tage nach Tag
    const [last7days] = await pool.query<RowDataPacket[]>(`
      SELECT DATE(created_at) as date, action, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at), action
      ORDER BY date
    `);
    
    // Aktivste Benutzer
    const [activeUsers] = await pool.query<RowDataPacket[]>(`
      SELECT al.user_id, al.username, COUNT(*) as action_count
      FROM audit_logs al
      WHERE al.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY al.user_id, al.username
      ORDER BY action_count DESC
      LIMIT 10
    `);
    
    // Häufigste Entity-Typen
    const [entityTypes] = await pool.query<RowDataPacket[]>(`
      SELECT entity_type, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY entity_type
      ORDER BY count DESC
    `);
    
    res.json({
      last24h,
      last7days,
      activeUsers,
      entityTypes
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Audit-Statistiken:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET /api/audit-logs/entity/:type/:id - Logs für spezifische Entität
router.get('/entity/:type/:id', async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT al.*, u.display_name as user_display_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.entity_type = ? AND al.entity_id = ?
       ORDER BY al.created_at DESC
       LIMIT 100`,
      [type, id]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Entity-Logs:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET /api/audit-logs/actions - Alle verfügbaren Aktionstypen
router.get('/actions', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT DISTINCT action FROM audit_logs ORDER BY action'
    );
    res.json(rows.map(r => r.action));
  } catch (error) {
    console.error('Fehler beim Abrufen der Aktionstypen:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET /api/audit-logs/entity-types - Alle verfügbaren Entity-Typen
router.get('/entity-types', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type'
    );
    res.json(rows.map(r => r.entity_type));
  } catch (error) {
    console.error('Fehler beim Abrufen der Entity-Typen:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
