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

export default router;
