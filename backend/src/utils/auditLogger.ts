import pool from '../config/database';
import { Request } from 'express';

export interface AuditLogEntry {
  user_id?: number;
  username?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'VIEW' | 'EXPORT' | 'IMPORT' | 'STOCK_IN' | 'STOCK_OUT' | 'TRANSFER';
  entity_type: string;
  entity_id?: number;
  entity_name?: string;
  old_values?: object;
  new_values?: object;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Erstellt einen Audit-Log-Eintrag
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs 
       (user_id, username, action, entity_type, entity_id, entity_name, old_values, new_values, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.user_id || null,
        entry.username || null,
        entry.action,
        entry.entity_type,
        entry.entity_id || null,
        entry.entity_name || null,
        entry.old_values ? JSON.stringify(entry.old_values) : null,
        entry.new_values ? JSON.stringify(entry.new_values) : null,
        entry.ip_address || null,
        entry.user_agent || null
      ]
    );
  } catch (error) {
    // Fehler nur loggen, nicht werfen - Audit-Logs sollten nie die Hauptfunktion blockieren
    console.error('Fehler beim Erstellen des Audit-Logs:', error);
  }
}

/**
 * Erstellt einen Audit-Log-Eintrag aus einem Request
 */
export async function logFromRequest(
  req: Request,
  action: AuditLogEntry['action'],
  entity_type: string,
  entity_id?: number,
  entity_name?: string,
  old_values?: object,
  new_values?: object
): Promise<void> {
  const user = (req as any).user;
  
  await createAuditLog({
    user_id: user?.id,
    username: user?.fullName || user?.username || 'Unbekannt',
    action,
    entity_type,
    entity_id,
    entity_name,
    old_values,
    new_values,
    ip_address: req.ip || req.headers['x-forwarded-for']?.toString() || 'Unbekannt',
    user_agent: req.headers['user-agent']
  });
}

/**
 * Helper für Material-Aktionen
 */
export const auditMaterial = {
  create: async (req: Request, material: { id: number; name: string }, values: object) => {
    await logFromRequest(req, 'CREATE', 'MATERIAL', material.id, material.name, undefined, values);
  },
  update: async (req: Request, material: { id: number; name: string }, oldValues: object, newValues: object) => {
    await logFromRequest(req, 'UPDATE', 'MATERIAL', material.id, material.name, oldValues, newValues);
  },
  delete: async (req: Request, material: { id: number; name: string }) => {
    await logFromRequest(req, 'DELETE', 'MATERIAL', material.id, material.name);
  },
  stockIn: async (req: Request, material: { id: number; name: string }, quantity: number, oldStock: number) => {
    await logFromRequest(req, 'STOCK_IN', 'MATERIAL', material.id, material.name, 
      { stock: oldStock }, { stock: oldStock + quantity, change: quantity });
  },
  stockOut: async (req: Request, material: { id: number; name: string }, quantity: number, oldStock: number) => {
    await logFromRequest(req, 'STOCK_OUT', 'MATERIAL', material.id, material.name,
      { stock: oldStock }, { stock: oldStock - quantity, change: -quantity });
  }
};

/**
 * Helper für Cabinet-Aktionen
 */
export const auditCabinet = {
  create: async (req: Request, cabinet: { id: number; name: string }, values: object) => {
    await logFromRequest(req, 'CREATE', 'CABINET', cabinet.id, cabinet.name, undefined, values);
  },
  update: async (req: Request, cabinet: { id: number; name: string }, oldValues: object, newValues: object) => {
    await logFromRequest(req, 'UPDATE', 'CABINET', cabinet.id, cabinet.name, oldValues, newValues);
  },
  delete: async (req: Request, cabinet: { id: number; name: string }) => {
    await logFromRequest(req, 'DELETE', 'CABINET', cabinet.id, cabinet.name);
  }
};

/**
 * Helper für User-Aktionen
 */
export const auditUser = {
  login: async (req: Request, user: { id: number; username: string }) => {
    await createAuditLog({
      user_id: user.id,
      username: user.username,
      action: 'LOGIN',
      entity_type: 'USER',
      entity_id: user.id,
      entity_name: user.username,
      ip_address: req.ip || req.headers['x-forwarded-for']?.toString(),
      user_agent: req.headers['user-agent']
    });
  },
  logout: async (req: Request) => {
    const user = (req as any).user;
    await logFromRequest(req, 'LOGOUT', 'USER', user?.id, user?.username);
  },
  create: async (req: Request, user: { id: number; username: string }) => {
    await logFromRequest(req, 'CREATE', 'USER', user.id, user.username);
  },
  update: async (req: Request, user: { id: number; username: string }, oldValues: object, newValues: object) => {
    await logFromRequest(req, 'UPDATE', 'USER', user.id, user.username, oldValues, newValues);
  },
  delete: async (req: Request, user: { id: number; username: string }) => {
    await logFromRequest(req, 'DELETE', 'USER', user.id, user.username);
  }
};

/**
 * Helper für Kategorie-Aktionen
 */
export const auditCategory = {
  create: async (req: Request, category: { id: number; name: string }) => {
    await logFromRequest(req, 'CREATE', 'CATEGORY', category.id, category.name);
  },
  update: async (req: Request, category: { id: number; name: string }, oldValues: object, newValues: object) => {
    await logFromRequest(req, 'UPDATE', 'CATEGORY', category.id, category.name, oldValues, newValues);
  },
  delete: async (req: Request, category: { id: number; name: string }) => {
    await logFromRequest(req, 'DELETE', 'CATEGORY', category.id, category.name);
  }
};

/**
 * Helper für Firmen-Aktionen
 */
export const auditCompany = {
  create: async (req: Request, company: { id: number; name: string }) => {
    await logFromRequest(req, 'CREATE', 'COMPANY', company.id, company.name);
  },
  update: async (req: Request, company: { id: number; name: string }, oldValues: object, newValues: object) => {
    await logFromRequest(req, 'UPDATE', 'COMPANY', company.id, company.name, oldValues, newValues);
  },
  delete: async (req: Request, company: { id: number; name: string }) => {
    await logFromRequest(req, 'DELETE', 'COMPANY', company.id, company.name);
  }
};

/**
 * Helper für Interventionen
 */
export const auditIntervention = {
  create: async (req: Request, intervention: { id: number; patient_name?: string }) => {
    await logFromRequest(req, 'CREATE', 'INTERVENTION', intervention.id, `Intervention #${intervention.id}`);
  },
  update: async (req: Request, intervention: { id: number }, oldValues: object, newValues: object) => {
    await logFromRequest(req, 'UPDATE', 'INTERVENTION', intervention.id, `Intervention #${intervention.id}`, oldValues, newValues);
  },
  delete: async (req: Request, intervention: { id: number }) => {
    await logFromRequest(req, 'DELETE', 'INTERVENTION', intervention.id, `Intervention #${intervention.id}`);
  }
};

/**
 * Helper für Transaktionen (Stock-Bewegungen)
 */
export const auditTransaction = {
  updateLot: async (req: Request, transaction: { id: number; material_name?: string }, oldLot: string | null, newLot: string | null) => {
    await logFromRequest(req, 'UPDATE', 'TRANSACTION', transaction.id, 
      transaction.material_name || `Transaktion #${transaction.id}`,
      { lot_number: oldLot },
      { lot_number: newLot }
    );
  }
};
