import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();

// POST /api/admin/reset-database - Löscht alle Daten aus der Datenbank
router.post('/reset-database', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Reihenfolge wichtig wegen Foreign Key Constraints
    // Zuerst abhängige Tabellen, dann Haupttabellen
    
    console.log('Starte Datenbank-Reset...');
    
    // Abhängige Tabellen zuerst
    await connection.query('DELETE FROM material_transactions');
    console.log('✓ material_transactions gelöscht');
    
    await connection.query('DELETE FROM barcodes');
    console.log('✓ barcodes gelöscht');
    
    await connection.query('DELETE FROM material_custom_fields');
    console.log('✓ material_custom_fields gelöscht');
    
    // Haupttabellen
    await connection.query('DELETE FROM materials');
    console.log('✓ materials gelöscht');
    
    await connection.query('DELETE FROM cabinets');
    console.log('✓ cabinets gelöscht');
    
    await connection.query('DELETE FROM companies');
    console.log('✓ companies gelöscht');
    
    await connection.query('DELETE FROM categories');
    console.log('✓ categories gelöscht');
    
    await connection.query('DELETE FROM field_configurations');
    console.log('✓ field_configurations gelöscht');
    
    // Optional: users Tabelle (falls vorhanden)
    try {
      await connection.query('DELETE FROM users');
      console.log('✓ users gelöscht');
    } catch (err) {
      // Tabelle existiert möglicherweise nicht
      console.log('ℹ users Tabelle nicht vorhanden oder bereits leer');
    }
    
    // AUTO_INCREMENT zurücksetzen
    await connection.query('ALTER TABLE materials AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE categories AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE companies AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE cabinets AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE barcodes AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE material_transactions AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE material_custom_fields AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE field_configurations AUTO_INCREMENT = 1');
    console.log('✓ AUTO_INCREMENT zurückgesetzt');

    await connection.commit();
    
    console.log('✅ Datenbank erfolgreich geleert!');
    res.json({ 
      success: true, 
      message: 'Datenbank wurde erfolgreich geleert',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Fehler beim Zurücksetzen der Datenbank:', error);
    res.status(500).json({ 
      error: 'Fehler beim Zurücksetzen der Datenbank',
      details: error instanceof Error ? error.message : 'Unbekannter Fehler'
    });
  } finally {
    connection.release();
  }
});

export default router;
