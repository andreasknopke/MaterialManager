import { Router, Request, Response } from 'express';
import pool, { getPoolForRequest } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { authenticate } from '../middleware/auth';
import { mistralService } from '../services/mistral.service';

const router = Router();

// Alle Routes benötigen Authentifizierung
router.use(authenticate);

// GET Status der KI-Integration
router.get('/status', async (req: Request, res: Response) => {
  try {
    const enabled = mistralService.isEnabled();
    res.json({
      enabled,
      model: 'mistral-large-latest',
      features: {
        productSuggestions: enabled,
        barcodeAnalysis: enabled,
        autocomplete: enabled
      }
    });
  } catch (error) {
    console.error('Fehler beim Abrufen des KI-Status:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des KI-Status' });
  }
});

// POST Produktvorschläge generieren
router.post('/suggest-products', async (req: Request, res: Response) => {
  try {
    if (!mistralService.isEnabled()) {
      return res.status(503).json({ 
        error: 'KI-Service nicht verfügbar',
        message: 'MISTRAL_API_KEY ist nicht konfiguriert'
      });
    }

    const { query, includeContext = false } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query-Parameter erforderlich' });
    }

    const currentPool = getPoolForRequest(req);
    
    // Hole existierende Produktnamen für Kontext
    const [existingProducts] = await currentPool.query<RowDataPacket[]>(
      'SELECT DISTINCT name FROM products ORDER BY created_at DESC LIMIT 100'
    );
    const productNames = existingProducts.map((p: RowDataPacket) => p.name);

    // Optionaler Kontext
    let context = undefined;
    if (includeContext) {
      const [categories] = await currentPool.query<RowDataPacket[]>(
        'SELECT DISTINCT name FROM categories ORDER BY name'
      );
      const [companies] = await currentPool.query<RowDataPacket[]>(
        'SELECT DISTINCT name FROM companies ORDER BY name'
      );
      const [recentMaterials] = await currentPool.query<RowDataPacket[]>(
        'SELECT DISTINCT name FROM materials WHERE active = TRUE ORDER BY created_at DESC LIMIT 20'
      );

      context = {
        categories: categories.map((c: RowDataPacket) => c.name),
        companies: companies.map((c: RowDataPacket) => c.name),
        recentMaterials: recentMaterials.map((m: RowDataPacket) => m.name)
      };
    }

    const suggestions = await mistralService.generateProductSuggestions(
      query,
      productNames,
      context
    );

    res.json({
      query,
      suggestions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Fehler beim Generieren von Produktvorschlägen:', error);
    res.status(500).json({ 
      error: 'Fehler beim Generieren von Vorschlägen',
      message: error instanceof Error ? error.message : 'Unbekannter Fehler'
    });
  }
});

// POST Barcode analysieren
router.post('/analyze-barcode', async (req: Request, res: Response) => {
  try {
    if (!mistralService.isEnabled()) {
      return res.status(503).json({ 
        error: 'KI-Service nicht verfügbar',
        message: 'MISTRAL_API_KEY ist nicht konfiguriert'
      });
    }

    const { barcode, scannedText } = req.body;

    if (!barcode || barcode.trim().length === 0) {
      return res.status(400).json({ error: 'Barcode-Parameter erforderlich' });
    }

    const suggestion = await mistralService.analyzeBarcode(barcode, scannedText);

    if (!suggestion) {
      return res.json({
        barcode,
        found: false,
        message: 'Keine Produktinformationen aus Barcode extrahierbar'
      });
    }

    res.json({
      barcode,
      found: true,
      suggestion,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Fehler bei Barcode-Analyse:', error);
    res.status(500).json({ 
      error: 'Fehler bei der Barcode-Analyse',
      message: error instanceof Error ? error.message : 'Unbekannter Fehler'
    });
  }
});

// POST Produktname Autocomplete
router.post('/autocomplete', async (req: Request, res: Response) => {
  try {
    if (!mistralService.isEnabled()) {
      return res.status(503).json({ 
        error: 'KI-Service nicht verfügbar',
        message: 'MISTRAL_API_KEY ist nicht konfiguriert'
      });
    }

    const { input } = req.body;

    if (!input || input.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Input zu kurz',
        message: 'Mindestens 2 Zeichen erforderlich'
      });
    }

    const currentPool = getPoolForRequest(req);
    
    // Hole existierende Produkte für besseren Kontext
    const [existingProducts] = await currentPool.query<RowDataPacket[]>(
      'SELECT DISTINCT name FROM products ORDER BY name LIMIT 200'
    );
    const productNames = existingProducts.map((p: RowDataPacket) => p.name);

    const suggestions = await mistralService.autocompleteProduct(input, productNames);

    res.json({
      input,
      suggestions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Fehler bei Autocomplete:', error);
    res.status(500).json({ 
      error: 'Fehler bei der Vervollständigung',
      message: error instanceof Error ? error.message : 'Unbekannter Fehler'
    });
  }
});

// POST Material-Lookup auf externer Webseite
router.post('/lookup-material', async (req: Request, res: Response) => {
  try {
    if (!mistralService.isEnabled()) {
      return res.status(503).json({ 
        error: 'KI-Service nicht verfügbar',
        message: 'MISTRAL_API_KEY ist nicht konfiguriert'
      });
    }

    const { materialId } = req.body;

    if (!materialId) {
      return res.status(400).json({ error: 'materialId erforderlich' });
    }

    const currentPool = getPoolForRequest(req);
    
    // Hole Material mit Kategorie-Link
    const [materials] = await currentPool.query<RowDataPacket[]>(
      `SELECT 
        m.*,
        c.endo_today_link,
        c.name as category_name
      FROM materials m
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.id = ?`,
      [materialId]
    );

    if (materials.length === 0) {
      return res.status(404).json({ error: 'Material nicht gefunden' });
    }

    const material = materials[0];

    if (!material.endo_today_link) {
      return res.status(400).json({ 
        error: 'Kein Link in Kategorie hinterlegt',
        message: 'Die Kategorie dieses Materials hat keinen endo_today_link'
      });
    }

    // Lade Webseite
    console.log(`Lade Webseite: ${material.endo_today_link}`);
    const response = await fetch(material.endo_today_link);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Extrahiere Text-Content (vereinfachte HTML->Text Konvertierung)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Bereite Material-Eigenschaften vor
    const targetProperties = {
      deviceLength: material.device_length,
      shaftLength: material.shaft_length,
      frenchSize: material.french_size,
      diameter: material.device_diameter,
      shapeName: material.shape_name
    };

    console.log('Suche nach ähnlichen Produkten mit Eigenschaften:', targetProperties);

    // Analysiere mit LLM
    const similarProducts = await mistralService.lookupSimilarProducts(
      textContent,
      targetProperties
    );

    res.json({
      material: {
        id: material.id,
        name: material.name,
        category: material.category_name,
        properties: targetProperties
      },
      sourceUrl: material.endo_today_link,
      results: similarProducts,
      totalMatches: similarProducts.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fehler bei Material-Lookup:', error);
    res.status(500).json({ 
      error: 'Fehler beim Material-Lookup',
      message: error instanceof Error ? error.message : 'Unbekannter Fehler'
    });
  }
});

// POST Inventur-Foto analysieren (Vision-basierter Inhaltsabgleich)
router.post('/analyze-inventory-photo', async (req: Request, res: Response) => {
  try {
    if (!mistralService.isEnabled()) {
      return res.status(503).json({ 
        error: 'KI-Service nicht verfügbar',
        message: 'MISTRAL_API_KEY ist nicht konfiguriert'
      });
    }

    const { cabinetId, imageBase64 } = req.body;

    if (!cabinetId) {
      return res.status(400).json({ error: 'cabinetId erforderlich' });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 erforderlich (Foto als Base64-String)' });
    }

    const currentPool = getPoolForRequest(req);

    // Prüfe Zugriff auf den Schrank
    if (!req.user?.isRoot && req.user?.departmentId) {
      const [cabinetCheck] = await currentPool.query<RowDataPacket[]>(
        'SELECT id FROM cabinets WHERE id = ? AND unit_id = ?',
        [cabinetId, req.user.departmentId]
      );
      if (cabinetCheck.length === 0) {
        return res.status(403).json({ error: 'Schrank nicht gefunden oder kein Zugriff' });
      }
    }

    // Hole Schrank-Info
    const [cabinetRows] = await currentPool.query<RowDataPacket[]>(
      'SELECT id, name, location FROM cabinets WHERE id = ?',
      [cabinetId]
    );

    if (cabinetRows.length === 0) {
      return res.status(404).json({ error: 'Schrank nicht gefunden' });
    }

    const cabinet = cabinetRows[0];

    // Hole alle Fächer des Schranks
    const [compartments] = await currentPool.query<RowDataPacket[]>(
      'SELECT id, name, description, position FROM compartments WHERE cabinet_id = ? AND active = TRUE ORDER BY position, name',
      [cabinetId]
    );

    // Für jedes Fach: Hole Materialien
    const materialList: Array<{
      compartmentName: string;
      materials: Array<{
        name: string;
        quantity: number;
        articleNumber?: string;
      }>;
    }> = [];

    for (const comp of compartments) {
      const [materials] = await currentPool.query<RowDataPacket[]>(
        `SELECT 
           m.name,
           m.article_number,
           SUM(m.current_stock) AS total_stock
         FROM materials m
         WHERE m.compartment_id = ? AND m.active = TRUE
         GROUP BY m.name, m.article_number
         ORDER BY m.name`,
        [comp.id]
      );

      materialList.push({
        compartmentName: comp.name + (comp.description ? ` (${comp.description})` : ''),
        materials: materials.map((m: any) => ({
          name: m.name,
          quantity: m.total_stock,
          articleNumber: m.article_number
        }))
      });
    }

    // Auch Materialien ohne Fach-Zuordnung
    const [unassignedMaterials] = await currentPool.query<RowDataPacket[]>(
      `SELECT 
         m.name,
         m.article_number,
         SUM(m.current_stock) AS total_stock
       FROM materials m
       WHERE m.cabinet_id = ? AND m.compartment_id IS NULL AND m.active = TRUE
       GROUP BY m.name, m.article_number
       ORDER BY m.name`,
      [cabinetId]
    );

    if (unassignedMaterials.length > 0) {
      materialList.push({
        compartmentName: 'Ohne Fachzuordnung',
        materials: unassignedMaterials.map((m: any) => ({
          name: m.name,
          quantity: m.total_stock,
          articleNumber: m.article_number
        }))
      });
    }

    console.log(`Analysiere Inventur-Foto für Schrank "${cabinet.name}" mit ${materialList.length} Fächern`);

    // Analysiere mit Vision-Modell
    const analysisResult = await mistralService.analyzeInventoryPhoto(
      imageBase64,
      materialList
    );

    res.json({
      cabinet: {
        id: cabinet.id,
        name: cabinet.name,
        location: cabinet.location
      },
      materialList,
      analysis: analysisResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fehler bei Inventur-Foto-Analyse:', error);
    res.status(500).json({ 
      error: 'Fehler bei der Inventur-Foto-Analyse',
      message: error instanceof Error ? error.message : 'Unbekannter Fehler'
    });
  }
});

export default router;
