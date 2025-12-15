import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

// Hilfsfunktion: ISO-Datum zu MySQL-Datetime konvertieren
const toMySQLDatetime = (isoString: string | Date | null): string => {
  if (!isoString) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  const date = new Date(isoString);
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

// Interface für Protokoll-Item
interface ProtocolItem {
  materialName: string;
  articleNumber: string;
  lotNumber: string;
  gtin?: string;
  quantity: number;
  timestamp: string;
  isConsignment?: boolean;
}

// GET alle Interventionsprotokolle (mit Suche)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, from_date, to_date, gtin, lot_number, limit = 50, offset = 0 } = req.query;
    
    // Wenn nach GTIN oder LOT gefiltert wird, brauchen wir einen JOIN
    const needsItemJoin = !!(gtin || lot_number);
    
    let sql = `
      SELECT DISTINCT
        ip.*,
        u.username as created_by_name,
        (SELECT COUNT(*) FROM intervention_protocol_items WHERE protocol_id = ip.id) as item_count
      FROM intervention_protocols ip
      LEFT JOIN users u ON ip.created_by = u.id
      ${needsItemJoin ? 'INNER JOIN intervention_protocol_items ipi ON ipi.protocol_id = ip.id' : ''}
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (search) {
      sql += ` AND (ip.patient_id LIKE ? OR ip.patient_name LIKE ? OR ip.notes LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    if (from_date) {
      sql += ` AND DATE(ip.started_at) >= ?`;
      params.push(from_date);
    }
    
    if (to_date) {
      sql += ` AND DATE(ip.started_at) <= ?`;
      params.push(to_date);
    }
    
    // Filter nach GTIN (article_number in intervention_protocol_items)
    if (gtin) {
      sql += ` AND ipi.article_number LIKE ?`;
      params.push(`%${gtin}%`);
    }
    
    // Filter nach LOT-Nummer
    if (lot_number) {
      sql += ` AND ipi.lot_number LIKE ?`;
      params.push(`%${lot_number}%`);
    }
    
    sql += ` ORDER BY ip.started_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));
    
    const [protocols] = await pool.query<RowDataPacket[]>(sql, params);
    
    // Gesamtanzahl für Pagination
    let countSql = `
      SELECT COUNT(DISTINCT ip.id) as total
      FROM intervention_protocols ip
      ${needsItemJoin ? 'INNER JOIN intervention_protocol_items ipi ON ipi.protocol_id = ip.id' : ''}
      WHERE 1=1
    `;
    const countParams: any[] = [];
    
    if (search) {
      countSql += ` AND (ip.patient_id LIKE ? OR ip.patient_name LIKE ? OR ip.notes LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
    }
    
    if (from_date) {
      countSql += ` AND DATE(ip.started_at) >= ?`;
      countParams.push(from_date);
    }
    
    if (to_date) {
      countSql += ` AND DATE(ip.started_at) <= ?`;
      countParams.push(to_date);
    }
    
    if (gtin) {
      countSql += ` AND ipi.article_number LIKE ?`;
      countParams.push(`%${gtin}%`);
    }
    
    if (lot_number) {
      countSql += ` AND ipi.lot_number LIKE ?`;
      countParams.push(`%${lot_number}%`);
    }
    
    const [countResult] = await pool.query<RowDataPacket[]>(countSql, countParams);
    
    res.json({
      protocols,
      total: countResult[0].total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    console.error('Fehler beim Laden der Interventionsprotokolle:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET einzelnes Protokoll mit Items
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Protokoll laden
    const [protocols] = await pool.query<RowDataPacket[]>(
      `SELECT 
        ip.*,
        u.username as created_by_name
       FROM intervention_protocols ip
       LEFT JOIN users u ON ip.created_by = u.id
       WHERE ip.id = ?`,
      [id]
    );
    
    if (protocols.length === 0) {
      return res.status(404).json({ error: 'Protokoll nicht gefunden' });
    }
    
    // Items laden
    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM intervention_protocol_items 
       WHERE protocol_id = ? 
       ORDER BY taken_at ASC`,
      [id]
    );
    
    res.json({
      protocol: protocols[0],
      items
    });
  } catch (error) {
    console.error('Fehler beim Laden des Protokolls:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST neues Interventionsprotokoll speichern
router.post('/', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const { patient_id, patient_name, started_at, notes, items } = req.body;
    const user_id = (req as any).user?.id || null;
    
    if (!patient_id) {
      return res.status(400).json({ error: 'Patienten-ID ist erforderlich' });
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Mindestens ein Protokoll-Eintrag ist erforderlich' });
    }
    
    await connection.beginTransaction();
    
    // Protokoll erstellen
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO intervention_protocols 
       (patient_id, patient_name, started_at, ended_at, total_items, notes, created_by)
       VALUES (?, ?, ?, NOW(), ?, ?, ?)`,
      [
        patient_id,
        patient_name || null,
        toMySQLDatetime(started_at),
        items.length,
        notes || null,
        user_id
      ]
    );
    
    const protocolId = result.insertId;
    
    // Items einfügen
    for (const item of items as ProtocolItem[]) {
      await connection.query(
        `INSERT INTO intervention_protocol_items 
         (protocol_id, material_name, article_number, lot_number, gtin, quantity, is_consignment, taken_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          protocolId,
          item.materialName,
          item.articleNumber || null,
          item.lotNumber || null,
          item.gtin || null,
          item.quantity || 1,
          item.isConsignment ? 1 : 0,
          toMySQLDatetime(item.timestamp)
        ]
      );
    }
    
    await connection.commit();
    
    res.status(201).json({
      success: true,
      protocol_id: protocolId,
      message: `Interventionsprotokoll mit ${items.length} Einträgen gespeichert`
    });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Speichern des Protokolls:', error);
    res.status(500).json({ error: 'Datenbankfehler beim Speichern' });
  } finally {
    connection.release();
  }
});

// DELETE Protokoll löschen
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Items werden durch CASCADE automatisch gelöscht
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM intervention_protocols WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Protokoll nicht gefunden' });
    }
    
    res.json({ success: true, message: 'Protokoll gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Protokolls:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
