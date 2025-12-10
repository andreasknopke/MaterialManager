import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { authenticate, requireAdmin, requireRoot } from '../middleware/auth';

const router = Router();

// Alle Routes benötigen Authentifizierung
router.use(authenticate);

// GET /api/users - Alle Benutzer abrufen (nur Admin)
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log('=== GET USERS DEBUG ===');
    console.log('Current User:', { id: req.user!.id, isRoot: req.user!.isRoot, departmentId: req.user!.departmentId });

    let query = 'SELECT * FROM v_users_overview';
    const params: any[] = [];

    // Department Admin sieht nur Benutzer seines Departments
    if (!req.user!.isRoot) {
      query += ' WHERE department_id = ? OR id = ?';
      params.push(req.user!.departmentId, req.user!.id); // Eigener User immer sichtbar
    }

    query += ' ORDER BY created_at DESC';

    console.log('📝 Query:', query);
    console.log('Params:', params);

    const [users] = await pool.query<RowDataPacket[]>(query, params);
    
    console.log('📊 Users returned from v_users_overview:');
    users.forEach((user: any) => {
      console.log(`  User ${user.id}: username=${user.username}, department_id=${user.department_id}, department_name=${user.department_name}`);
    });
    
    res.json(users);
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzer:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET /api/users/:id - Einzelnen Benutzer abrufen
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Benutzer darf nur eigene Daten sehen, außer er ist Admin
    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM v_users_overview WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen des Benutzers:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/users - Neuen Benutzer erstellen (nur Admin)
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { username, email, password, fullName, role, departmentId } = req.body;

    console.log('=== CREATE USER DEBUG ===');
    console.log('Request Body:', { username, email, fullName, role, departmentId });
    console.log('Current User:', { id: req.user!.id, isRoot: req.user!.isRoot, departmentId: req.user!.departmentId });

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, E-Mail und Passwort sind erforderlich' });
    }

    // Department Admins können nur User in ihrem eigenen Department erstellen
    if (!req.user!.isRoot && departmentId && departmentId !== req.user!.departmentId) {
      console.log('❌ Department Admin versucht User in anderem Department zu erstellen');
      return res.status(403).json({ error: 'Sie können nur Benutzer in Ihrem eigenen Department erstellen' });
    }

    // Department Admins müssen Department zuweisen
    const finalDepartmentId = req.user!.isRoot ? (departmentId || null) : req.user!.departmentId;
    console.log('Final Department ID:', finalDepartmentId, '(isRoot:', req.user!.isRoot, ', received:', departmentId, ')');

    // Prüfe ob Benutzer bereits existiert
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Benutzername oder E-Mail bereits vergeben' });
    }

    // Passwort hashen
    const passwordHash = await bcrypt.hash(password, 10);

    console.log('📝 Executing INSERT with params:', {
      username,
      email,
      fullName: fullName || null,
      role: role || 'user',
      department_id: finalDepartmentId
    });

    // Benutzer erstellen
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (username, email, password_hash, full_name, role, department_id, email_verified, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)`,
      [username, email, passwordHash, fullName || null, role || 'user', finalDepartmentId]
    );

    console.log('✅ User created with ID:', result.insertId);
    
    // Prüfe was tatsächlich gespeichert wurde
    const [checkUser] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, email, role, department_id FROM users WHERE id = ?',
      [result.insertId]
    );
    console.log('📊 Verification - User in DB:', checkUser[0]);

    // Audit-Log
    await pool.query(
      'INSERT INTO user_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [req.user!.id, 'user_created', JSON.stringify({ new_user_id: result.insertId, username }), req.ip]
    );

    res.status(201).json({
      message: 'Benutzer erfolgreich erstellt',
      userId: result.insertId,
    });
  } catch (error) {
    console.error('Fehler beim Erstellen des Benutzers:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Benutzers' });
  }
});

// PUT /api/users/:id - Benutzer aktualisieren
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { username, fullName, email, role, active, departmentId } = req.body;

    console.log('=== UPDATE USER DEBUG ===');
    console.log('User ID to update:', userId);
    console.log('Request Body:', { username, fullName, email, role, active, departmentId });
    console.log('Current User:', { id: req.user!.id, isRoot: req.user!.isRoot, departmentId: req.user!.departmentId });

    // Benutzer darf nur eigene Daten ändern, außer er ist Admin
    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    // Normale Benutzer dürfen ihre Rolle nicht ändern
    if (req.user!.id === userId && role !== undefined) {
      return res.status(403).json({ error: 'Sie können Ihre eigene Rolle nicht ändern' });
    }

    // Prüfe ob Root-User
    const [targetUser] = await pool.query<RowDataPacket[]>(
      'SELECT is_root, department_id FROM users WHERE id = ?',
      [userId]
    );

    if (targetUser.length > 0 && targetUser[0].is_root && !req.user!.isRoot) {
      return res.status(403).json({ error: 'Root-Benutzer kann nur von Root geändert werden' });
    }

    // Department Admin kann nur User im eigenen Department bearbeiten
    if (!req.user!.isRoot && targetUser[0].department_id !== req.user!.departmentId) {
      return res.status(403).json({ error: 'Sie können nur Benutzer in Ihrem eigenen Department bearbeiten' });
    }

    // Update
    const updates: string[] = [];
    const values: any[] = [];

    // Nur Admins können Username ändern
    if (username !== undefined && req.user!.role === 'admin') {
      // Prüfe ob neuer Username bereits vergeben ist
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, userId]
      );
      
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Benutzername bereits vergeben' });
      }
      
      updates.push('username = ?');
      values.push(username);
    }

    if (fullName !== undefined) {
      updates.push('full_name = ?');
      values.push(fullName);
    }

    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }

    if (role !== undefined && req.user!.role === 'admin') {
      updates.push('role = ?');
      values.push(role);
    }

    if (active !== undefined && req.user!.role === 'admin') {
      updates.push('active = ?');
      values.push(active);
    }

    // Nur Root kann Department ändern
    if (departmentId !== undefined && req.user!.isRoot) {
      console.log('🔄 Department wird aktualisiert:', departmentId, '(type:', typeof departmentId, ')');
      updates.push('department_id = ?');
      values.push(departmentId);
    } else if (departmentId !== undefined && !req.user!.isRoot) {
      console.log('⚠️ Department Update verweigert - User ist kein Root');
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Keine Änderungen angegeben' });
    }

    console.log('📝 Executing UPDATE with:', updates.join(', '));
    console.log('Values:', values);

    values.push(userId);

    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Prüfe was tatsächlich gespeichert wurde
    const [checkUser] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, email, role, department_id FROM users WHERE id = ?',
      [userId]
    );
    console.log('📊 Verification - User in DB after update:', checkUser[0]);

    // Audit-Log
    await pool.query(
      'INSERT INTO user_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [req.user!.id, 'user_updated', JSON.stringify({ target_user_id: userId, changes: req.body }), req.ip]
    );

    res.json({ message: 'Benutzer erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Benutzers:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

// DELETE /api/users/:id - Benutzer löschen (nur Admin, nicht Root-User)
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    // Prüfe ob Root-User
    const [targetUser] = await pool.query<RowDataPacket[]>(
      'SELECT is_root, username FROM users WHERE id = ?',
      [userId]
    );

    if (targetUser.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    if (targetUser[0].is_root) {
      return res.status(403).json({ error: 'Root-Benutzer kann nicht gelöscht werden' });
    }

    // Benutzer kann sich nicht selbst löschen
    if (req.user!.id === userId) {
      return res.status(403).json({ error: 'Sie können sich nicht selbst löschen' });
    }

    // Benutzer löschen
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);

    // Audit-Log
    await pool.query(
      'INSERT INTO user_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [req.user!.id, 'user_deleted', JSON.stringify({ deleted_user_id: userId, username: targetUser[0].username }), req.ip]
    );

    res.json({ message: 'Benutzer erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Benutzers:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// POST /api/users/:id/make-admin - Benutzer zum Admin machen (nur Root)
router.post('/:id/make-admin', requireRoot, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    await pool.query('UPDATE users SET role = ? WHERE id = ?', ['admin', userId]);

    // Audit-Log
    await pool.query(
      'INSERT INTO user_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [req.user!.id, 'role_change', JSON.stringify({ target_user_id: userId, new_role: 'admin' }), req.ip]
    );

    res.json({ message: 'Benutzer ist jetzt Administrator' });
  } catch (error) {
    console.error('Fehler beim Ändern der Rolle:', error);
    res.status(500).json({ error: 'Fehler beim Ändern der Rolle' });
  }
});

// POST /api/users/:id/remove-admin - Admin-Rechte entfernen (nur Root)
router.post('/:id/remove-admin', requireRoot, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    // Prüfe ob Root-User
    const [targetUser] = await pool.query<RowDataPacket[]>(
      'SELECT is_root FROM users WHERE id = ?',
      [userId]
    );

    if (targetUser.length > 0 && targetUser[0].is_root) {
      return res.status(403).json({ error: 'Root-Benutzer kann nicht degradiert werden' });
    }

    await pool.query('UPDATE users SET role = ? WHERE id = ?', ['user', userId]);

    // Audit-Log
    await pool.query(
      'INSERT INTO user_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [req.user!.id, 'role_change', JSON.stringify({ target_user_id: userId, new_role: 'user' }), req.ip]
    );

    res.json({ message: 'Admin-Rechte wurden entfernt' });
  } catch (error) {
    console.error('Fehler beim Ändern der Rolle:', error);
    res.status(500).json({ error: 'Fehler beim Ändern der Rolle' });
  }
});

// GET /api/users/:id/audit-log - Audit-Log eines Benutzers abrufen (nur Admin)
router.get('/:id/audit-log', requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;

    const [logs] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM user_audit_log 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, limit]
    );

    res.json(logs);
  } catch (error) {
    console.error('Fehler beim Abrufen des Audit-Logs:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

export default router;
