import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';

const router = Router();

// Helper: Get department filter from user context
const getDepartmentFilter = (req: Request, tableAlias: string = 'm'): { whereClause: string; params: any[] } => {
  const user = (req as any).user;
  const prefix = tableAlias ? `${tableAlias}.` : '';
  
  if (user?.isRoot) {
    return { whereClause: '', params: [] };
  }
  
  if (user?.departmentId) {
    return { whereClause: `${prefix}unit_id = ?`, params: [user.departmentId] };
  }
  
  return { whereClause: '', params: [] };
};

// Hilfsfunktion: ISO-Datum zu MySQL-Datetime konvertieren
const toMySQLDatetime = (isoString: string | Date | null): string => {
  if (!isoString) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  const date = new Date(isoString);
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

// Hilfsfunktion: Verfallsdatum zu MySQL-DATE konvertieren (YYYY-MM-DD)
const toMySQLDate = (dateString: string | null | undefined): string | null => {
  if (!dateString) return null;
  try {
    // Falls bereits im Format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    // Falls ISO-Format oder anderes Datumsformat
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  } catch {
    return null;
  }
};

// Interface für Protokoll-Item
interface ProtocolItem {
  materialName: string;
  articleNumber: string;
  lotNumber: string;
  expiryDate?: string;
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

// =========================================================================
// NEUE ENDPUNKTE FÜR NACHTRÄGLICHE PATIENTENZUORDNUNG
// Diese Routen MÜSSEN vor /:id definiert werden!
// =========================================================================

// GET nicht zugeordnete Materialausgänge (Stock-Outs ohne Patientenzuordnung)
router.get('/unassigned/transactions', async (req: Request, res: Response) => {
  try {
    const { 
      search, 
      from_date, 
      to_date, 
      gtin, 
      lot_number, 
      category_id,
      limit = 50, 
      offset = 0 
    } = req.query;
    
    // Department-Filter
    const departmentFilter = getDepartmentFilter(req, 'm');
    
    let sql = `
      SELECT 
        t.id AS transaction_id,
        t.material_id,
        m.name AS material_name,
        m.article_number,
        COALESCE(t.lot_number, m.lot_number) AS lot_number,
        m.expiry_date,
        t.quantity,
        t.transaction_date,
        t.usage_type,
        t.notes,
        t.reference_number,
        COALESCE(u.full_name, u.username, t.user_name) AS performed_by,
        m.unit_id,
        un.name AS unit_name,
        cat.name AS category_name,
        m.is_consignment
      FROM material_transactions t
      JOIN materials m ON t.material_id = m.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN units un ON m.unit_id = un.id
      LEFT JOIN categories cat ON m.category_id = cat.id
      WHERE t.transaction_type = 'out'
        AND t.protocol_item_id IS NULL
    `;
    const params: any[] = [];
    
    // Department-Filter anwenden
    if (departmentFilter.whereClause) {
      sql += ` AND ${departmentFilter.whereClause}`;
      params.push(...departmentFilter.params);
    }
    
    // Suche nach Material-Name oder Notizen
    if (search) {
      sql += ` AND (m.name LIKE ? OR t.notes LIKE ? OR t.reference_number LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    // Datumsfilter
    if (from_date) {
      sql += ` AND DATE(t.transaction_date) >= ?`;
      params.push(from_date);
    }
    
    if (to_date) {
      sql += ` AND DATE(t.transaction_date) <= ?`;
      params.push(to_date);
    }
    
    // GTIN-Filter
    if (gtin) {
      sql += ` AND m.article_number LIKE ?`;
      params.push(`%${gtin}%`);
    }
    
    // LOT-Nummer-Filter
    if (lot_number) {
      sql += ` AND (t.lot_number LIKE ? OR m.lot_number LIKE ?)`;
      params.push(`%${lot_number}%`, `%${lot_number}%`);
    }
    
    // Kategorie-Filter
    if (category_id) {
      sql += ` AND m.category_id = ?`;
      params.push(category_id);
    }
    
    sql += ` ORDER BY t.transaction_date DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));
    
    const [transactions] = await pool.query<RowDataPacket[]>(sql, params);
    
    // Gesamtanzahl für Pagination
    let countSql = `
      SELECT COUNT(*) as total
      FROM material_transactions t
      JOIN materials m ON t.material_id = m.id
      WHERE t.transaction_type = 'out'
        AND t.protocol_item_id IS NULL
    `;
    const countParams: any[] = [];
    
    if (departmentFilter.whereClause) {
      countSql += ` AND ${departmentFilter.whereClause}`;
      countParams.push(...departmentFilter.params);
    }
    
    if (search) {
      countSql += ` AND (m.name LIKE ? OR t.notes LIKE ? OR t.reference_number LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
    }
    
    if (from_date) {
      countSql += ` AND DATE(t.transaction_date) >= ?`;
      countParams.push(from_date);
    }
    
    if (to_date) {
      countSql += ` AND DATE(t.transaction_date) <= ?`;
      countParams.push(to_date);
    }
    
    if (gtin) {
      countSql += ` AND m.article_number LIKE ?`;
      countParams.push(`%${gtin}%`);
    }
    
    if (lot_number) {
      countSql += ` AND (t.lot_number LIKE ? OR m.lot_number LIKE ?)`;
      countParams.push(`%${lot_number}%`, `%${lot_number}%`);
    }
    
    if (category_id) {
      countSql += ` AND m.category_id = ?`;
      countParams.push(category_id);
    }
    
    const [countResult] = await pool.query<RowDataPacket[]>(countSql, countParams);
    
    res.json({
      transactions,
      total: countResult[0].total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    console.error('Fehler beim Laden der nicht zugeordneten Ausgänge:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST Neues Protokoll aus nicht zugeordneten Transaktionen erstellen
router.post('/create-from-transactions', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const { patient_id, patient_name, notes, transaction_ids } = req.body;
    const user_id = (req as any).user?.id || null;
    
    if (!patient_id) {
      return res.status(400).json({ error: 'Patienten-ID ist erforderlich' });
    }
    
    if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json({ error: 'Mindestens eine Transaktions-ID ist erforderlich' });
    }
    
    await connection.beginTransaction();
    
    // Transaktionen laden
    const placeholders = transaction_ids.map(() => '?').join(',');
    const [transactions] = await connection.query<RowDataPacket[]>(
      `SELECT t.*, m.name AS material_name, m.article_number, m.lot_number AS material_lot, m.expiry_date, m.is_consignment
       FROM material_transactions t
       JOIN materials m ON t.material_id = m.id
       WHERE t.id IN (${placeholders}) AND t.transaction_type = 'out' AND t.protocol_item_id IS NULL
       ORDER BY t.transaction_date ASC`,
      transaction_ids
    );
    
    if (transactions.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Keine gültigen nicht zugeordneten Transaktionen gefunden' });
    }
    
    // Zeitraum bestimmen
    const startedAt = transactions[0].transaction_date;
    const endedAt = transactions[transactions.length - 1].transaction_date;
    
    // Protokoll erstellen
    const [protocolResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO intervention_protocols 
       (patient_id, patient_name, started_at, ended_at, total_items, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        patient_id,
        patient_name || null,
        startedAt,
        endedAt,
        transactions.length,
        notes || 'Nachträglich zugeordnet',
        user_id
      ]
    );
    
    const protocolId = protocolResult.insertId;
    
    // Items erstellen und Transaktionen verknüpfen
    for (const transaction of transactions) {
      const [itemResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO intervention_protocol_items 
         (protocol_id, transaction_id, material_name, article_number, lot_number, expiry_date, gtin, quantity, is_consignment, taken_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          protocolId,
          transaction.id,
          transaction.material_name,
          transaction.article_number || null,
          transaction.lot_number || transaction.material_lot || null,
          transaction.expiry_date || null,
          transaction.article_number || null,
          transaction.quantity,
          transaction.is_consignment ? 1 : 0,
          transaction.transaction_date
        ]
      );
      
      // Transaktion mit Protocol-Item verknüpfen
      await connection.query(
        'UPDATE material_transactions SET protocol_item_id = ? WHERE id = ?',
        [itemResult.insertId, transaction.id]
      );
    }
    
    await connection.commit();
    
    res.status(201).json({
      success: true,
      protocol_id: protocolId,
      message: `Interventionsprotokoll mit ${transactions.length} Einträgen erstellt`
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Fehler beim Erstellen des Protokolls aus Transaktionen:', error);
    res.status(500).json({ 
      error: 'Datenbankfehler beim Speichern',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
});

// =========================================================================
// ROUTEN MIT DYNAMISCHEN PARAMETERN (/:id)
// =========================================================================

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
         (protocol_id, material_name, article_number, lot_number, expiry_date, gtin, quantity, is_consignment, taken_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          protocolId,
          item.materialName,
          item.articleNumber || null,
          item.lotNumber || null,
          toMySQLDate(item.expiryDate),
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
  } catch (error: any) {
    await connection.rollback();
    console.error('Fehler beim Speichern des Protokolls:', error);
    console.error('Error details:', error.message, error.code, error.sqlMessage);
    res.status(500).json({ 
      error: 'Datenbankfehler beim Speichern',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
});

// DELETE Protokoll löschen
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Verknüpfungen in material_transactions aufheben
    await pool.query(
      'UPDATE material_transactions SET protocol_item_id = NULL WHERE protocol_item_id IN (SELECT id FROM intervention_protocol_items WHERE protocol_id = ?)',
      [id]
    );
    
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

// POST Items zu bestehendem Protokoll hinzufügen (aus nicht zugeordneten Transaktionen)
router.post('/:id/add-items', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const { transaction_ids } = req.body;
    
    if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json({ error: 'Mindestens eine Transaktions-ID ist erforderlich' });
    }
    
    await connection.beginTransaction();
    
    // Prüfen ob Protokoll existiert
    const [protocols] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM intervention_protocols WHERE id = ?',
      [id]
    );
    
    if (protocols.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Protokoll nicht gefunden' });
    }
    
    let addedCount = 0;
    
    for (const transactionId of transaction_ids) {
      // Transaktion laden und prüfen ob nicht bereits zugeordnet
      const [transactions] = await connection.query<RowDataPacket[]>(
        `SELECT t.*, m.name AS material_name, m.article_number, m.lot_number AS material_lot, m.expiry_date, m.is_consignment
         FROM material_transactions t
         JOIN materials m ON t.material_id = m.id
         WHERE t.id = ? AND t.transaction_type = 'out' AND t.protocol_item_id IS NULL`,
        [transactionId]
      );
      
      if (transactions.length === 0) {
        continue; // Transaktion nicht gefunden oder bereits zugeordnet
      }
      
      const transaction = transactions[0];
      
      // Neues Protocol-Item erstellen
      const [itemResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO intervention_protocol_items 
         (protocol_id, transaction_id, material_name, article_number, lot_number, expiry_date, gtin, quantity, is_consignment, taken_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          transactionId,
          transaction.material_name,
          transaction.article_number || null,
          transaction.lot_number || transaction.material_lot || null,
          transaction.expiry_date || null,
          transaction.article_number || null, // GTIN = article_number
          transaction.quantity,
          transaction.is_consignment ? 1 : 0,
          transaction.transaction_date
        ]
      );
      
      // Transaktion mit Protocol-Item verknüpfen
      await connection.query(
        'UPDATE material_transactions SET protocol_item_id = ? WHERE id = ?',
        [itemResult.insertId, transactionId]
      );
      
      addedCount++;
    }
    
    // total_items im Protokoll aktualisieren
    await connection.query(
      'UPDATE intervention_protocols SET total_items = (SELECT COUNT(*) FROM intervention_protocol_items WHERE protocol_id = ?) WHERE id = ?',
      [id, id]
    );
    
    await connection.commit();
    
    res.json({
      success: true,
      message: `${addedCount} Materialausgänge zum Protokoll hinzugefügt`,
      added_count: addedCount
    });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Hinzufügen von Items:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  } finally {
    connection.release();
  }
});

// DELETE Item aus Protokoll entfernen (Zuordnung aufheben)
router.delete('/:protocolId/items/:itemId', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const { protocolId, itemId } = req.params;
    
    await connection.beginTransaction();
    
    // Verknüpfung in material_transactions aufheben
    await connection.query(
      'UPDATE material_transactions SET protocol_item_id = NULL WHERE protocol_item_id = ?',
      [itemId]
    );
    
    // Item löschen
    const [result] = await connection.query<ResultSetHeader>(
      'DELETE FROM intervention_protocol_items WHERE id = ? AND protocol_id = ?',
      [itemId, protocolId]
    );
    
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Item nicht gefunden' });
    }
    
    // total_items aktualisieren
    await connection.query(
      'UPDATE intervention_protocols SET total_items = (SELECT COUNT(*) FROM intervention_protocol_items WHERE protocol_id = ?) WHERE id = ?',
      [protocolId, protocolId]
    );
    
    await connection.commit();
    
    res.json({ success: true, message: 'Item aus Protokoll entfernt' });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Entfernen des Items:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  } finally {
    connection.release();
  }
});

// PUT LOT-Nummer einer Transaktion korrigieren (nur Root-Admin)
// WICHTIG: Diese Route muss VOR /:id stehen, da sonst "transactions" als :id gematched wird
router.put('/transactions/:transactionId/lot', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Nur Root-Admins dürfen LOT-Nummern korrigieren
    if (!user?.isRoot) {
      return res.status(403).json({ error: 'Keine Berechtigung. Nur Root-Admins können LOT-Nummern korrigieren.' });
    }
    
    const { transactionId } = req.params;
    const { lot_number } = req.body;
    
    if (lot_number === undefined) {
      return res.status(400).json({ error: 'LOT-Nummer ist erforderlich' });
    }
    
    // Prüfen ob die Transaktion existiert und vom Typ 'out' ist
    const [transactions] = await pool.query<RowDataPacket[]>(
      'SELECT id, transaction_type FROM material_transactions WHERE id = ?',
      [transactionId]
    );
    
    if (transactions.length === 0) {
      return res.status(404).json({ error: 'Transaktion nicht gefunden' });
    }
    
    if (transactions[0].transaction_type !== 'out') {
      return res.status(400).json({ error: 'Nur Materialausgänge (Stock Outs) können korrigiert werden' });
    }
    
    // LOT-Nummer aktualisieren
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE material_transactions SET lot_number = ? WHERE id = ?',
      [lot_number || null, transactionId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Transaktion nicht gefunden' });
    }
    
    console.log(`LOT-Nummer für Transaktion ${transactionId} aktualisiert auf: ${lot_number || '(leer)'} durch User ${user.username}`);
    
    res.json({ success: true, message: 'LOT-Nummer erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der LOT-Nummer:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT Protokoll-Details aktualisieren
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { patient_id, patient_name, notes } = req.body;
    
    if (!patient_id) {
      return res.status(400).json({ error: 'Patienten-ID ist erforderlich' });
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE intervention_protocols SET patient_id = ?, patient_name = ?, notes = ? WHERE id = ?',
      [patient_id, patient_name || null, notes || null, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Protokoll nicht gefunden' });
    }
    
    res.json({ success: true, message: 'Protokoll aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Protokolls:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
