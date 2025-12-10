import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { generateToken, authenticate, requireAdmin, requireRoot } from '../middleware/auth';

const router = Router();

// POST /api/auth/register - Neuen Benutzer registrieren
router.post('/register', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const { username, email, password, fullName } = req.body;

    // Validierung
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, E-Mail und Passwort sind erforderlich' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
    }

    // Prüfe ob Benutzer bereits existiert
    const [existing] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Benutzername oder E-Mail bereits vergeben' });
    }

    // Passwort hashen
    const passwordHash = await bcrypt.hash(password, 10);

    // Benutzer erstellen (email_verified = TRUE, da keine Verifizierung)
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO users (
        username, email, password_hash, full_name, email_verified
      ) VALUES (?, ?, ?, ?, TRUE)`,
      [username, email, passwordHash, fullName || null]
    );

    // Audit-Log
    await connection.query(
      'INSERT INTO user_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [result.insertId, 'register', JSON.stringify({ username, email }), req.ip]
    );

    res.status(201).json({
      message: 'Benutzer erfolgreich erstellt.',
      userId: result.insertId,
    });
  } catch (error) {
    console.error('Registrierungsfehler:', error);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  } finally {
    connection.release();
  }
});

// POST /api/auth/login - Benutzer anmelden
router.post('/login', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const { username, password } = req.body;

    console.log('=== LOGIN ATTEMPT ===');
    console.log('Username:', username);
    console.log('Password length:', password ? password.length : 0);

    if (!username || !password) {
      return res.status(400).json({ error: 'Username und Passwort sind erforderlich' });
    }

    // Rate Limiting prüfen
    const [recentAttempts] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM login_attempts 
       WHERE email = ? AND attempted_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)`,
      [username]
    );

    console.log('Recent login attempts:', recentAttempts[0].count);

    if (recentAttempts[0].count >= 5) {
      return res.status(429).json({ 
        error: 'Zu viele fehlgeschlagene Login-Versuche. Bitte warten Sie 15 Minuten.' 
      });
    }

    // Benutzer finden
    const [users] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    console.log('Users found:', users.length);
    if (users.length > 0) {
      console.log('User data:', {
        id: users[0].id,
        username: users[0].username,
        email: users[0].email,
        active: users[0].active,
        password_hash_start: users[0].password_hash?.substring(0, 20)
      });
    }

    if (users.length === 0) {
      console.log('❌ No user found with username/email:', username);
      await connection.query(
        'INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, FALSE)',
        [username, req.ip]
      );
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const user = users[0];

    // Passwort prüfen
    console.log('Comparing password...');
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    console.log('Password match:', passwordMatch);

    if (!passwordMatch) {
      await connection.query(
        'INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, FALSE)',
        [user.email, req.ip]
      );
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Prüfe ob Benutzer aktiv ist
    if (!user.active) {
      return res.status(403).json({ error: 'Benutzer ist deaktiviert' });
    }

    // Token generieren
    const token = generateToken(user.id, user.username, user.email, user.role, user.is_root, user.department_id);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Stunden

    // Session erstellen
    await connection.query(
      'INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
      [user.id, tokenHash, req.ip, req.headers['user-agent'], expiresAt]
    );

    // Last login aktualisieren
    await connection.query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Erfolgreichen Login loggen
    await connection.query(
      'INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, TRUE)',
      [user.email, req.ip]
    );

    await connection.query(
      'INSERT INTO user_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [user.id, 'login', JSON.stringify({ method: 'password' }), req.ip]
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isRoot: user.is_root,
        departmentId: user.department_id,
        emailVerified: user.email_verified,
        mustChangePassword: user.must_change_password,
      },
    });
  } catch (error) {
    console.error('Login-Fehler:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  } finally {
    connection.release();
  }
});

// POST /api/auth/logout - Benutzer abmelden
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader!.substring(7);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Session löschen
    await pool.query('DELETE FROM user_sessions WHERE token_hash = ?', [tokenHash]);

    // Audit-Log
    await pool.query(
      'INSERT INTO user_audit_log (user_id, action, ip_address) VALUES (?, ?, ?)',
      [req.user!.id, 'logout', req.ip]
    );

    res.json({ message: 'Erfolgreich abgemeldet' });
  } catch (error) {
    console.error('Logout-Fehler:', error);
    res.status(500).json({ error: 'Logout fehlgeschlagen' });
  }
});

// GET /api/auth/me - Aktuellen Benutzer abrufen
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const [users] = await pool.query<RowDataPacket[]>(
      `SELECT id, username, email, full_name, role, is_root, department_id, active, 
              email_verified, must_change_password, last_login, created_at 
       FROM users WHERE id = ?`,
      [req.user!.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const user = users[0];

    // Konvertiere snake_case zu camelCase für Frontend
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      isRoot: user.is_root,
      departmentId: user.department_id,
      mustChangePassword: user.must_change_password,
    });
  } catch (error) {
    console.error('Fehler beim Abrufen des Benutzers:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Benutzerdaten' });
  }
});

// POST /api/auth/change-password - Passwort ändern
router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Aktuelles und neues Passwort sind erforderlich' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
    }

    // Aktuelles Passwort prüfen
    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user!.id]
    );

    const passwordMatch = await bcrypt.compare(currentPassword, users[0].password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
    }

    // Neues Passwort hashen
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Passwort aktualisieren
    await pool.query(
      'UPDATE users SET password_hash = ?, must_change_password = FALSE WHERE id = ?',
      [newPasswordHash, req.user!.id]
    );

    // Alle anderen Sessions löschen
    const authHeader = req.headers.authorization;
    const currentToken = authHeader!.substring(7);
    const currentTokenHash = crypto.createHash('sha256').update(currentToken).digest('hex');
    
    await pool.query(
      'DELETE FROM user_sessions WHERE user_id = ? AND token_hash != ?',
      [req.user!.id, currentTokenHash]
    );

    // Audit-Log
    await pool.query(
      'INSERT INTO user_audit_log (user_id, action, ip_address) VALUES (?, ?, ?)',
      [req.user!.id, 'password_change', req.ip]
    );

    res.json({ message: 'Passwort erfolgreich geändert' });
  } catch (error) {
    console.error('Passwortänderungsfehler:', error);
    res.status(500).json({ error: 'Passwortänderung fehlgeschlagen' });
  }
});

export default router;
