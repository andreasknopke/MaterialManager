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
    
    let query = 'SELECT * FROM cabinets';
    const params: any[] = [];
    const conditions: string[] = [];
    
    // Root sieht alle Schränke (auch inaktive), andere nur ihre Abteilungs-Schränke (nur aktive)
    // Hinweis: Wir filtern nach unit_id (Abteilungszuordnung des Schranks), nicht department_id
    if (!req.user?.isRoot && req.user?.departmentId) {
      conditions.push('active = TRUE');
      conditions.push('unit_id = ?');
      params.push(req.user.departmentId);
      console.log('Unit Filter applied: unit_id =', req.user.departmentId);
    } else if (!req.user?.isRoot && !req.user?.departmentId) {
      // User ohne Department sieht nichts
      conditions.push('1 = 0');
      console.log('User has no department - returning empty result');
    } else {
      // Root sieht alles, auch inaktive Schränke
      console.log('Root user - no filter applied, showing all cabinets');
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
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
    let query = 'SELECT * FROM cabinets WHERE id = ?';
    const params: any[] = [req.params.id];
    
    // Non-Root User können nur Schränke ihrer Abteilung (unit_id) sehen
    if (!req.user?.isRoot && req.user?.departmentId) {
      query += ' AND unit_id = ?';
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
    // Non-Root User können nur Materialien aus Schränken ihrer Abteilung sehen
    if (!req.user?.isRoot && req.user?.departmentId) {
      // Prüfe ob der Schrank zur Abteilung (unit_id) des Users gehört
      const [cabinetCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cabinets WHERE id = ? AND unit_id = ?',
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

// GET Schrank-Infoblatt (Fächer mit Materialien und Custom Fields)
router.get('/:id/infosheet', async (req: Request, res: Response) => {
  try {
    // Prüfe Zugriff auf den Schrank
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [cabinetCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cabinets WHERE id = ? AND unit_id = ?',
        [req.params.id, req.user.departmentId]
      );
      if (cabinetCheck.length === 0) {
        return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
      }
    }

    // Hole Schrank-Infos
    const [cabinetRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM cabinets WHERE id = ?',
      [req.params.id]
    );

    if (cabinetRows.length === 0) {
      return res.status(404).json({ error: 'Schrank nicht gefunden' });
    }

    const cabinet = cabinetRows[0];

    // Hole alle Fächer des Schranks
    const [compartments] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM compartments WHERE cabinet_id = ? ORDER BY position, name',
      [req.params.id]
    );

    // Für jedes Fach: Hole Materialien gruppiert nach GTIN mit Custom Fields
    const compartmentsWithMaterials = await Promise.all(
      compartments.map(async (comp: any) => {
        // Hole Materialien gruppiert nach GTIN (article_number)
        const [materials] = await pool.query<RowDataPacket[]>(
          `SELECT 
             m.article_number,
             m.name,
             m.size,
             cat.name AS category_name,
             SUM(m.current_stock) AS total_stock,
             COUNT(*) AS item_count,
             MIN(m.id) AS first_material_id
           FROM materials m
           LEFT JOIN categories cat ON m.category_id = cat.id
           WHERE m.compartment_id = ? AND m.active = TRUE
           GROUP BY m.article_number, m.name, m.size, cat.name
           ORDER BY cat.name, m.name`,
          [comp.id]
        );

        // Für jede Materialgruppe: Hole Custom Fields vom ersten Material
        const materialsWithFields = await Promise.all(
          materials.map(async (mat: any) => {
            const [customFields] = await pool.query<RowDataPacket[]>(
              `SELECT 
                 fc.field_label,
                 mcf.field_value
               FROM material_custom_fields mcf
               JOIN field_configurations fc ON mcf.field_config_id = fc.id
               WHERE mcf.material_id = ? AND fc.active = TRUE AND mcf.field_value IS NOT NULL AND mcf.field_value != ''
               ORDER BY fc.display_order`,
              [mat.first_material_id]
            );

            return {
              article_number: mat.article_number,
              name: mat.name,
              size: mat.size,
              category_name: mat.category_name,
              total_stock: mat.total_stock,
              item_count: mat.item_count,
              custom_fields: customFields
            };
          })
        );

        return {
          ...comp,
          materials: materialsWithFields
        };
      })
    );

    res.json({
      cabinet,
      compartments: compartmentsWithMaterials
    });
  } catch (error) {
    console.error('Fehler beim Abrufen des Schrank-Infoblatts:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST neuer Schrank
router.post('/', async (req: Request, res: Response) => {
  const { name, location, description, capacity } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }
  
  // Department Admin kann nur Schränke für seine eigene Abteilung erstellen
  // unit_id ist die Abteilungszuordnung des Schranks
  const unit_id = req.user?.isRoot && req.body.unit_id ? req.body.unit_id : req.user?.departmentId;
  
  if (!unit_id) {
    return res.status(400).json({ error: 'Abteilung (unit_id) ist erforderlich' });
  }
  
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO cabinets (name, location, description, capacity, unit_id) VALUES (?, ?, ?, ?, ?)',
      [name, location, description, capacity || 0, unit_id]
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
    // Non-Root User können nur Schränke ihrer Abteilung bearbeiten
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [cabinetCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cabinets WHERE id = ? AND unit_id = ?',
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
    // Non-Root User können nur Schränke ihrer Abteilung löschen
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [cabinetCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cabinets WHERE id = ? AND unit_id = ?',
        [req.params.id, req.user.departmentId]
      );
      if (cabinetCheck.length === 0) {
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

// ==================== FÄCHER (COMPARTMENTS) ====================

// GET alle Fächer eines Schranks
router.get('/:id/compartments', async (req: Request, res: Response) => {
  try {
    // Prüfe Zugriff auf den Schrank
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [cabinetCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cabinets WHERE id = ? AND unit_id = ?',
        [req.params.id, req.user.departmentId]
      );
      if (cabinetCheck.length === 0) {
        return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
      }
    }
    
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM materials m WHERE m.compartment_id = c.id AND m.active = TRUE) AS material_count
       FROM compartments c 
       WHERE c.cabinet_id = ? AND c.active = TRUE 
       ORDER BY c.position, c.name`,
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Fächer:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST neues Fach erstellen
router.post('/:id/compartments', async (req: Request, res: Response) => {
  const { name, description, position } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Fachname ist erforderlich' });
  }
  
  try {
    // Prüfe Zugriff auf den Schrank
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [cabinetCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cabinets WHERE id = ? AND unit_id = ?',
        [req.params.id, req.user.departmentId]
      );
      if (cabinetCheck.length === 0) {
        return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
      }
    }
    
    // Prüfe ob Fachname bereits existiert
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM compartments WHERE cabinet_id = ? AND name = ?',
      [req.params.id, name]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Ein Fach mit diesem Namen existiert bereits in diesem Schrank' });
    }
    
    // Ermittle nächste Position falls nicht angegeben
    let pos = position;
    if (pos === undefined || pos === null) {
      const [maxPos] = await pool.query<RowDataPacket[]>(
        'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM compartments WHERE cabinet_id = ?',
        [req.params.id]
      );
      pos = maxPos[0].next_pos;
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO compartments (cabinet_id, name, description, position) VALUES (?, ?, ?, ?)',
      [req.params.id, name, description || null, pos]
    );
    
    res.status(201).json({
      id: result.insertId,
      cabinet_id: parseInt(req.params.id),
      name,
      description,
      position: pos,
      message: 'Fach erfolgreich erstellt'
    });
  } catch (error) {
    console.error('Fehler beim Erstellen des Fachs:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT Fach aktualisieren
router.put('/:cabinetId/compartments/:compartmentId', async (req: Request, res: Response) => {
  const { name, description, position } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Fachname ist erforderlich' });
  }
  
  try {
    // Prüfe Zugriff auf den Schrank
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [cabinetCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cabinets WHERE id = ? AND unit_id = ?',
        [req.params.cabinetId, req.user.departmentId]
      );
      if (cabinetCheck.length === 0) {
        return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
      }
    }
    
    // Prüfe ob Fachname bereits von einem anderen Fach verwendet wird
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM compartments WHERE cabinet_id = ? AND name = ? AND id != ?',
      [req.params.cabinetId, name, req.params.compartmentId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Ein anderes Fach mit diesem Namen existiert bereits' });
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE compartments SET name = ?, description = ?, position = ? WHERE id = ? AND cabinet_id = ?',
      [name, description || null, position || 0, req.params.compartmentId, req.params.cabinetId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Fach nicht gefunden' });
    }
    
    res.json({ message: 'Fach erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Fachs:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE Fach (soft delete)
router.delete('/:cabinetId/compartments/:compartmentId', async (req: Request, res: Response) => {
  try {
    // Prüfe Zugriff auf den Schrank
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [cabinetCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cabinets WHERE id = ? AND unit_id = ?',
        [req.params.cabinetId, req.user.departmentId]
      );
      if (cabinetCheck.length === 0) {
        return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
      }
    }
    
    // Prüfe ob Materialien im Fach sind
    const [materials] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM materials WHERE compartment_id = ? AND active = TRUE',
      [req.params.compartmentId]
    );
    if (materials[0].count > 0) {
      return res.status(400).json({ 
        error: `Fach enthält noch ${materials[0].count} aktive(s) Material(ien). Bitte zuerst verschieben oder entfernen.` 
      });
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE compartments SET active = FALSE WHERE id = ? AND cabinet_id = ?',
      [req.params.compartmentId, req.params.cabinetId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Fach nicht gefunden' });
    }
    
    res.json({ message: 'Fach erfolgreich deaktiviert' });
  } catch (error) {
    console.error('Fehler beim Löschen des Fachs:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET Materialien eines Fachs (für QR-Code-Ausdruck)
router.get('/:cabinetId/compartments/:compartmentId/materials', async (req: Request, res: Response) => {
  try {
    // Prüfe Zugriff auf den Schrank
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [cabinetCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cabinets WHERE id = ? AND unit_id = ?',
        [req.params.cabinetId, req.user.departmentId]
      );
      if (cabinetCheck.length === 0) {
        return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
      }
    }
    
    // Hole Fach-Info
    const [compartmentRows] = await pool.query<RowDataPacket[]>(
      `SELECT c.*, cab.name AS cabinet_name, cab.location AS cabinet_location
       FROM compartments c
       JOIN cabinets cab ON c.cabinet_id = cab.id
       WHERE c.id = ? AND c.cabinet_id = ?`,
      [req.params.compartmentId, req.params.cabinetId]
    );
    
    if (compartmentRows.length === 0) {
      return res.status(404).json({ error: 'Fach nicht gefunden' });
    }
    
    // Hole Materialien im Fach (gruppiert nach Name um Mehrfachnennung zu vermeiden)
    const [materials] = await pool.query<RowDataPacket[]>(
      `SELECT 
         m.name,
         m.article_number,
         m.size,
         cat.name AS category_name,
         SUM(m.current_stock) AS total_stock,
         COUNT(*) AS item_count
       FROM materials m
       LEFT JOIN categories cat ON m.category_id = cat.id
       WHERE m.compartment_id = ? AND m.active = TRUE
       GROUP BY m.name, m.article_number, m.size, cat.name
       ORDER BY cat.name, m.name`,
      [req.params.compartmentId]
    );
    
    res.json({
      compartment: compartmentRows[0],
      materials
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Fach-Materialien:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST Schrank leeren (alle Materialien mit correction protokollieren)
// Fächerstruktur bleibt erhalten!
router.post('/:id/clear', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const cabinetId = req.params.id;
    
    // Prüfe Zugriff auf den Schrank
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [cabinetCheck] = await connection.query<RowDataPacket[]>(
        'SELECT id, name FROM cabinets WHERE id = ? AND unit_id = ?',
        [cabinetId, req.user.departmentId]
      );
      if (cabinetCheck.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
      }
    }
    
    // Hole Schrankname für Protokollierung
    const [cabinetInfo] = await connection.query<RowDataPacket[]>(
      'SELECT name FROM cabinets WHERE id = ?',
      [cabinetId]
    );
    
    if (cabinetInfo.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Schrank nicht gefunden' });
    }
    
    const cabinetName = cabinetInfo[0].name;
    
    // Hole alle aktiven Materialien im Schrank mit Bestand > 0
    const [materials] = await connection.query<RowDataPacket[]>(
      'SELECT id, current_stock, unit_id FROM materials WHERE cabinet_id = ? AND active = TRUE AND current_stock > 0',
      [cabinetId]
    );
    
    const userId = req.user?.id;
    const userName = req.user?.fullName || req.user?.username || 'Unbekannt';
    
    // Protokolliere jede Entnahme als Korrektur
    for (const material of materials) {
      await connection.query(
        `INSERT INTO material_transactions 
         (material_id, transaction_type, usage_type, quantity, previous_stock, new_stock, notes, user_id, user_name, unit_id)
         VALUES (?, 'out', 'correction', ?, ?, 0, ?, ?, ?, ?)`,
        [
          material.id, 
          material.current_stock, 
          material.current_stock, 
          `Korrektur: Schrank "${cabinetName}" geleert (Inventur)`,
          userId, 
          userName, 
          material.unit_id
        ]
      );
    }
    
    // Deaktiviere alle Materialien im Schrank und setze Bestand auf 0
    const [result] = await connection.query<ResultSetHeader>(
      'UPDATE materials SET active = FALSE, current_stock = 0 WHERE cabinet_id = ? AND active = TRUE',
      [cabinetId]
    );
    
    await connection.commit();
    
    res.json({ 
      message: `Schrank "${cabinetName}" erfolgreich geleert`,
      deactivatedCount: result.affectedRows
    });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Leeren des Schranks:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  } finally {
    connection.release();
  }
});

export default router;
