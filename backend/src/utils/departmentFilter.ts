// Helper-Funktionen für Department-basierte Zugriffskontrolle

import { Request } from 'express';

/**
 * Erstellt SQL-WHERE-Clause und Parameter für Department-Filterung
 * Root sieht alles, Department Admins/Users nur ihr Department
 */
export const getDepartmentFilter = (
  req: Request,
  tableAlias: string = 'm'
): { whereClause: string; params: any[] } => {
  const user = req.user;

  if (!user) {
    throw new Error('User nicht authentifiziert');
  }

  // Root sieht alles
  if (user.isRoot) {
    return { whereClause: '', params: [] };
  }

  // Department Admin/User sieht nur eigenes Department
  if (!user.departmentId) {
    throw new Error('Kein Department zugewiesen');
  }

  return {
    whereClause: `${tableAlias}.unit_id = ?`,
    params: [user.departmentId],
  };
};

/**
 * Prüft ob User Zugriff auf ein spezifisches Material/Cabinet hat
 */
export const checkDepartmentAccess = async (
  req: Request,
  resourceId: number,
  resourceType: 'material' | 'cabinet',
  pool: any
): Promise<boolean> => {
  const user = req.user;

  if (!user) {
    return false;
  }

  // Root hat immer Zugriff
  if (user.isRoot) {
    return true;
  }

  // Kein Department = kein Zugriff
  if (!user.departmentId) {
    return false;
  }

  // Prüfe ob Resource zum Department gehört
  const table = resourceType === 'material' ? 'materials' : 'cabinets';
  const [rows] = await pool.query(
    `SELECT id FROM ${table} WHERE id = ? AND unit_id = ?`,
    [resourceId, user.departmentId]
  );

  return rows.length > 0;
};

/**
 * Erstellt JOIN-Clause für Department-Filter über Cabinets
 * (für Materialien, die über cabinet_id gefiltert werden müssen)
 */
export const getDepartmentFilterViaCabinet = (
  req: Request
): { joinClause: string; whereClause: string; params: any[] } => {
  const user = req.user;

  if (!user) {
    throw new Error('User nicht authentifiziert');
  }

  // Root sieht alles
  if (user.isRoot) {
    return { joinClause: '', whereClause: '', params: [] };
  }

  // Department Admin/User sieht nur eigenes Department
  if (!user.departmentId) {
    throw new Error('Kein Department zugewiesen');
  }

  return {
    joinClause: 'LEFT JOIN cabinets c ON m.cabinet_id = c.id',
    whereClause: '(m.unit_id = ? OR c.unit_id = ?)',
    params: [user.departmentId, user.departmentId],
  };
};

export default {
  getDepartmentFilter,
  checkDepartmentAccess,
  getDepartmentFilterViaCabinet,
};
