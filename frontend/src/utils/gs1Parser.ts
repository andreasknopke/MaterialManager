/**
 * GS1 Barcode Parser
 * Parst GS1-128 Barcodes und extrahiert relevante Application Identifier (AI)
 * 
 * Verwendung in MaterialManager:
 * - GTIN (AI 01) → Artikelnummer zur Produktidentifikation
 * - Batch/Lot (AI 10) → Chargennummer
 * - Expiration Date (AI 17) → Verfallsdatum
 * - SSCC (AI 00) → Serial Shipping Container Code (optional)
 */

export interface GS1Data {
  gtin?: string;              // AI 01 - Global Trade Item Number (GTIN) → Artikelnummer
  batchNumber?: string;       // AI 10 - Batch/Lot Number → Chargennummer
  expiryDate?: string;        // AI 17 - Expiration Date (YYMMDD) → Verfallsdatum
  serialNumber?: string;      // AI 21 - Serial Number
  sscc?: string;             // AI 00 - Serial Shipping Container Code (optional)
  productionDate?: string;    // AI 11 - Production Date (YYMMDD)
  raw?: string;              // Original Barcode
}

/**
 * GS1 Application Identifiers (AI) Definitionen
 */
const AI_PATTERNS: { [key: string]: { length: number | null; name: string } } = {
  '00': { length: 18, name: 'SSCC' },
  '01': { length: 14, name: 'GTIN' },
  '10': { length: null, name: 'Batch/Lot Number' },
  '11': { length: 6, name: 'Production Date' },
  '17': { length: 6, name: 'Expiry Date' },
  '21': { length: null, name: 'Serial Number' },
};

/**
 * Konvertiert ein GS1-Datum (YYMMDD) in ISO-Format (YYYY-MM-DD)
 */
function parseGS1Date(gs1Date: string): string | null {
  if (!gs1Date || gs1Date.length !== 6) return null;
  
  const yy = gs1Date.substring(0, 2);
  const mm = gs1Date.substring(2, 4);
  const dd = gs1Date.substring(4, 6);
  
  // Jahr 2000+ annehmen
  const year = 2000 + parseInt(yy, 10);
  
  // ISO-Format: YYYY-MM-DD
  return `${year}-${mm}-${dd}`;
}

/**
 * Parst einen GS1 Barcode und extrahiert die relevanten Daten
 * @param barcode Der zu parsende Barcode (kann FNC1 als "~" oder "]" enthalten)
 * @returns Geparste GS1-Daten
 */
export function parseGS1Barcode(barcode: string): GS1Data {
  if (!barcode) {
    return { raw: barcode };
  }

  const result: GS1Data = { raw: barcode };
  
  // FNC1-Zeichen normalisieren (manchmal als ] oder ~ dargestellt)
  // eslint-disable-next-line no-control-regex
  let normalized = barcode.replace(/\]C1|~|\x1D/g, '');
  
  // Falls der Barcode mit ]C1, ]E0, ]d2 etc. beginnt (AIM Symbology Identifier)
  if (normalized.startsWith(']')) {
    normalized = normalized.substring(3);
  }
  
  let position = 0;
  
  while (position < normalized.length) {
    // Nächsten AI (2-4 Zeichen) suchen
    let ai: string | null = null;
    let aiLength = 0;
    
    // Versuche 4-stelligen, dann 3-stelligen, dann 2-stelligen AI
    for (let len = 4; len >= 2; len--) {
      const testAI = normalized.substring(position, position + len);
      if (AI_PATTERNS[testAI]) {
        ai = testAI;
        aiLength = len;
        break;
      }
    }
    
    if (!ai) {
      // Kein bekannter AI gefunden, abbrechen
      break;
    }
    
    position += aiLength;
    const pattern = AI_PATTERNS[ai];
    
    let value: string;
    
    if (pattern.length !== null) {
      // Feste Länge
      value = normalized.substring(position, position + pattern.length);
      position += pattern.length;
    } else {
      // Variable Länge - bis zum nächsten AI oder Ende
      let endPos = position;
      while (endPos < normalized.length) {
        // Prüfe ob an dieser Position ein neuer AI beginnt
        let foundNextAI = false;
        for (let len = 2; len <= 4; len++) {
          const testAI = normalized.substring(endPos, endPos + len);
          if (AI_PATTERNS[testAI]) {
            foundNextAI = true;
            break;
          }
        }
        if (foundNextAI) break;
        endPos++;
      }
      value = normalized.substring(position, endPos);
      position = endPos;
    }
    
    // Daten zuweisen
    switch (ai) {
      case '00':
        result.sscc = value;
        break;
      case '01':
        result.gtin = value;
        break;
      case '10':
        result.batchNumber = value;
        break;
      case '11':
        result.productionDate = parseGS1Date(value) || value;
        break;
      case '17':
        result.expiryDate = parseGS1Date(value) || value;
        break;
      case '21':
        result.serialNumber = value;
        break;
    }
  }
  
  return result;
}

/**
 * Validiert, ob ein String ein gültiger GS1-Barcode sein könnte
 */
export function isValidGS1Barcode(barcode: string): boolean {
  if (!barcode) return false;
  
  // Mindestlänge prüfen (AI + Daten)
  if (barcode.length < 4) return false;
  
  // Normalisieren
  // eslint-disable-next-line no-control-regex
  let normalized = barcode.replace(/\]C1|~|\x1D/g, '');
  if (normalized.startsWith(']')) {
    normalized = normalized.substring(3);
  }
  
  // Prüfe ob mindestens ein bekannter AI am Anfang steht
  for (let len = 2; len <= 4; len++) {
    const testAI = normalized.substring(0, len);
    if (AI_PATTERNS[testAI]) {
      return true;
    }
  }
  
  return false;
}
