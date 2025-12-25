import { Request, Response, NextFunction } from 'express';
import { decodeDbToken, DbCredentials } from '../config/database';

// Erweitere Express Request um dbCredentials property
declare global {
  namespace Express {
    interface Request {
      dbCredentials?: DbCredentials;
    }
  }
}

/**
 * Middleware: Extrahiert DB-Token aus X-DB-Token Header und dekodiert ihn
 * Fügt dbCredentials zum Request hinzu falls gültiger Token vorhanden
 */
export const extractDbToken = (req: Request, res: Response, next: NextFunction) => {
  const dbToken = req.headers['x-db-token'] as string;
  
  if (dbToken) {
    console.log('DB-Token im Request gefunden, dekodiere...');
    const credentials = decodeDbToken(dbToken);
    
    if (credentials) {
      req.dbCredentials = credentials;
      console.log(`✅ DB-Token erfolgreich dekodiert: ${credentials.host}:${credentials.port}/${credentials.database}`);
    } else {
      console.warn('❌ DB-Token ungültig oder fehlerhaft');
      // Nicht blockieren - verwende Standard-Credentials
    }
  }
  
  next();
};