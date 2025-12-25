/**
 * Utility für Database Pool Management mit DB-Token Support
 * Stellt vereinfachte Methoden für Routes bereit
 */
import { Request } from 'express';
import { getPoolForRequest, getConnectionForRequest } from '../config/database';

/**
 * Führt eine Query mit dem passenden Pool aus (automatische DB-Token Erkennung)
 */
export const queryWithToken = async (req: Request | undefined, query: string, params: any[] = []) => {
  const pool = getPoolForRequest(req);
  return pool.query(query, params);
};

/**
 * Holt eine Connection mit automatischer DB-Token Erkennung  
 */
export const getConnection = async (req: Request | undefined) => {
  return getConnectionForRequest(req);
};

/**
 * Execute Query mit Connection Management
 */
export const executeQuery = async (req: Request | undefined, query: string, params: any[] = []) => {
  const connection = await getConnection(req);
  try {
    return await connection.query(query, params);
  } finally {
    connection.release();
  }
};