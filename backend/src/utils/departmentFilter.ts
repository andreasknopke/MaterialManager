// Helper-Funktionen für Department-basierte Zugriffskontrolle

import { Request } from 'express';

/**
 * Erstellt SQL-WHERE-Clause und Parameter für Department-Filterung
 * Root sieht alles, Department Admins/Users nur ihr Department
 * 
 * @param req - Express Request mit user
 * @param tableAlias - Table Alias ('m' für materials, 'cabinets' für cabinets, etc.)
 * @param useUnitName - Wenn true, verwendet unit_name statt unit_id (für Views)
 */
export const getDepartmentFilter = (
  req: Request,
  tableAlias: string = 'm',
  useUnitName: boolean = false
): { whereClause: string; params: any[] } => {
  const user = req.user;

  console.log('getDepartmentFilter called with:', { 
    userId: user?.id, 
    isRoot: user?.isRoot, 
    departmentId: user?.departmentId,
    tableAlias,
    useUnitName
  });

  if (!user) {
    console.error('❌ User nicht authentifiziert');
    throw new Error('User nicht authentifiziert');
  }

  // Root sieht alles
  if (user.isRoot) {
    console.log('✅ Root user - no filter applied');
    return { whereClause: '', params: [] };
  }

  // Department Admin/User sieht nur eigenes Department
  if (!user.departmentId) {
    console.error('❌ User has no departmentId:', user);
    throw new Error('Kein Department zugewiesen');
  }

  // Für Views mit unit_name müssen wir gegen units table joinen
  if (useUnitName) {
    console.log(`✅ Applying department filter via subquery for departmentId: ${user.departmentId}`);
    const prefix = tableAlias ? `${tableAlias}.` : '';
    return {
      whereClause: `${prefix}unit_id IN (SELECT id FROM units WHERE id = ?)`,
      params: [user.departmentId],
    };
  }

  // Bestimme Prefix basierend auf tableAlias (leer = kein Prefix)
  const prefix = tableAlias ? `${tableAlias}.` : '';
  console.log(`✅ Applying department filter: ${prefix}unit_id = ${user.departmentId}`);
  
  return {
    whereClause: `${prefix}unit_id = ?`,
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
