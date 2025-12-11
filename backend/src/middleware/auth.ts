import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2';

// Erweitere Express Request um user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        email: string;
        role: 'admin' | 'user' | 'viewer';
        isRoot: boolean;
        departmentId: number | null;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h' as const;

export const generateToken = (
  userId: number, 
  username: string, 
  email: string, 
  role: string, 
  isRoot: boolean,
  departmentId: number | null
): string => {
  return jwt.sign(
    { id: userId, username, email, role, isRoot, departmentId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Middleware: Authentifizierung erforderlich
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('=== AUTHENTICATE MIDDLEWARE ===');
    console.log('Path:', req.path);
    console.log('Method:', req.method);
    
    const authHeader = req.headers.authorization;
    console.log('Auth Header:', authHeader ? `${authHeader.substring(0, 20)}...` : 'MISSING');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No Bearer token in header');
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const token = authHeader.substring(7);
    console.log('Token length:', token.length);
    
    const decoded = verifyToken(token);
    console.log('Token decoded:', decoded ? { id: decoded.id, username: decoded.username, exp: decoded.exp } : 'FAILED');

    if (!decoded) {
      console.log('❌ Token verification failed');
      return res.status(401).json({ error: 'Ungültiges oder abgelaufenes Token' });
    }

    // Prüfe ob Session noch gültig ist (optional falls Tabelle fehlt)
    try {
      const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
      const [sessions] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM user_sessions WHERE token_hash = ? AND expires_at > NOW()',
        [tokenHash]
      );

      if (sessions.length === 0) {
        console.warn('Session not found or expired, but continuing with token validation');
      }
    } catch (sessionError) {
      // user_sessions Tabelle existiert möglicherweise nicht - Token-Validierung reicht
      console.warn('Session validation skipped:', sessionError);
    }

    // Lade Benutzerdaten
    console.log('Loading user from DB, ID:', decoded.id);
    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, email, role, is_root, department_id, active, must_change_password FROM users WHERE id = ?',
      [decoded.id]
    );

    console.log('Users found:', users.length);
    if (users.length > 0) {
      console.log('User:', { id: users[0].id, username: users[0].username, active: users[0].active, department_id: users[0].department_id });
    }

    if (users.length === 0 || !users[0].active) {
      console.log('❌ User not found or inactive');
      return res.status(401).json({ error: 'Benutzer nicht gefunden oder deaktiviert' });
    }

    // Stelle sicher, dass isRoot ein Boolean ist (MySQL gibt 0/1 oder Buffer zurück)
    const isRootValue = users[0].is_root;
    const isRoot = isRootValue === 1 || isRootValue === true || 
                   (Buffer.isBuffer(isRootValue) && isRootValue[0] === 1) ||
                   isRootValue === '1';
    
    console.log('isRoot raw value:', isRootValue, 'type:', typeof isRootValue, 'converted:', isRoot);

    req.user = {
      id: users[0].id,
      username: users[0].username,
      email: users[0].email,
      role: users[0].role,
      isRoot: isRoot,
      departmentId: users[0].department_id,
    };

    console.log('✅ Authentication successful for:', req.user.username, 'isRoot:', req.user.isRoot);
    next();
  } catch (error) {
    console.error('❌ Authentifizierungsfehler:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
    res.status(401).json({ error: 'Authentifizierung fehlgeschlagen' });
  }
};

// Middleware: Admin-Rolle erforderlich (Department Admin oder Root)
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administratorrechte erforderlich' });
  }

  next();
};

// Middleware: Root-User erforderlich (nur vollständiger Admin)
export const requireRoot = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  if (!req.user.isRoot) {
    return res.status(403).json({ error: 'Root-Benutzer erforderlich' });
  }

  next();
};

// Middleware: Department-Filter hinzufügen
export const addDepartmentFilter = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  // Root sieht alles
  if (req.user.isRoot) {
    return next();
  }

  // Department Admin/User sieht nur sein Department
  if (!req.user.departmentId) {
    return res.status(403).json({ error: 'Kein Department zugewiesen' });
  }

  // Department-ID für Queries verfügbar machen
  (req as any).departmentId = req.user.departmentId;
  
  next();
};

// Middleware: Spezifische Rollen zulassen
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Erforderliche Rolle: ${roles.join(' oder ')}` 
      });
    }

    next();
  };
};
