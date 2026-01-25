import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { parseDbToken, isLegacyToken } from '../utils/crypto';

dotenv.config();

// Standard-Pool (Default Credentials)
const defaultPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'material_manager',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Cache für dynamische Pools (basierend auf DB-Token)
const dynamicPools = new Map<string, mysql.Pool>();

export interface DbCredentials {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
  ssl?: boolean;
}

/**
 * Dekodiert einen DB-Token zu Credentials
 * Unterstützt sowohl AES-verschlüsselte Tokens (neu) als auch Base64 (legacy)
 */
export const decodeDbToken = (token: string): DbCredentials | null => {
  try {
    // Verwende die crypto Utility für sichere Dekodierung
    const parsed = parseDbToken(token);
    
    if (!parsed || !parsed.host || !parsed.user || !parsed.database) {
      console.error('DB Token ungültig: Fehlende Felder');
      return null;
    }
    
    // Warnung bei Legacy-Token ausgeben
    if (isLegacyToken(token)) {
      console.warn('⚠️ Legacy Base64 Token erkannt - Bitte neu generieren für mehr Sicherheit!');
    }
    
    return {
      host: parsed.host,
      user: parsed.user,
      password: parsed.password || '',
      database: parsed.database,
      port: parsed.port || 3306,
      ssl: parsed.ssl !== false
    };
  } catch (e) {
    console.error('DB Token Dekodierung fehlgeschlagen:', e);
    return null;
  }
};

/**
 * Erstellt oder gibt einen cached Pool für die angegebenen Credentials zurück
 */
export const getDynamicPool = (credentials: DbCredentials): mysql.Pool => {
  const poolKey = `${credentials.host}:${credentials.port}:${credentials.database}:${credentials.user}`;
  
  if (dynamicPools.has(poolKey)) {
    return dynamicPools.get(poolKey)!;
  }
  
  console.log(`Erstelle neuen DB-Pool für: ${credentials.host}:${credentials.port}/${credentials.database}`);
  
  const newPool = mysql.createPool({
    host: credentials.host,
    port: credentials.port,
    user: credentials.user,
    password: credentials.password,
    database: credentials.database,
    waitForConnections: true,
    connectionLimit: 5, // Kleinere Limits für dynamische Pools
    queueLimit: 0,
    ...(credentials.ssl ? { ssl: {} } : {})
  });
  
  dynamicPools.set(poolKey, newPool);
  return newPool;
};

/**
 * Gibt den passenden Pool basierend auf Request zurück (mit DB-Token Support)
 */
export const getPoolForRequest = (req?: any): mysql.Pool => {
  // Prüfe auf DB-Token im Request
  if (req?.dbCredentials) {
    return getDynamicPool(req.dbCredentials);
  }
  
  // Fallback auf Standard-Pool
  return defaultPool;
};

/**
 * Utility: Gibt eine Connection aus dem passenden Pool zurück
 */
export const getConnectionForRequest = async (req?: any): Promise<mysql.PoolConnection> => {
  const pool = getPoolForRequest(req);
  return pool.getConnection();
};

export default defaultPool;
