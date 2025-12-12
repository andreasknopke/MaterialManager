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
 * Prüft ob der Barcode im Klammer-Format ist und parst ihn direkt
 * z.B. "(01)38935221200737(17)270731(10)250210A"
 * Bei Klammer-Format sind die Feldgrenzen exakt definiert durch die Klammern
 */
function parseGS1WithParentheses(barcode: string): GS1Data | null {
  // Prüfe ob der Barcode Klammern enthält - Format: (AI)value
  if (!barcode.includes('(')) {
    return null;
  }
  
  const result: GS1Data = { raw: barcode };
  let remaining = barcode;
  
  // Pattern: (AI)value wobei AI 2-4 Ziffern ist
  const aiPatternRegex = /^\((\d{2,4})\)(.*)$/;
  
  while (remaining.length > 0) {
    const match = remaining.match(aiPatternRegex);
    if (match) {
      const ai = match[1];
      remaining = match[2];
      
      // Finde den Wert bis zur nächsten Klammer oder Ende
      const nextParenPos = remaining.indexOf('(');
      let value: string;
      if (nextParenPos === -1) {
        // Keine weitere Klammer, Rest ist der Wert
        value = remaining;
        remaining = '';
      } else {
        // Wert bis zur nächsten Klammer
        value = remaining.substring(0, nextParenPos);
        remaining = remaining.substring(nextParenPos);
      }
      
      // Daten zuweisen basierend auf AI
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
    } else {
      // Kein Klammer-Pattern mehr gefunden
      break;
    }
  }
  
  return result;
}

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
 * @param barcode Der zu parsende Barcode (kann FNC1 als "~" oder "]" enthalten, sowie Klammern um AIs)
 * @returns Geparste GS1-Daten
 */
export function parseGS1Barcode(barcode: string): GS1Data {
  if (!barcode) {
    return { raw: barcode };
  }

  // Alle Leerzeichen entfernen (Scanner fügt manchmal Leerzeichen ein)
  let cleaned = barcode.replace(/\s+/g, '');
  
  // Wenn der Barcode Klammern enthält, parse ihn direkt mit Klammern als Feldgrenzen
  // Dies ist die zuverlässigste Methode, da die Klammern exakte Feldgrenzen definieren
  if (cleaned.includes('(')) {
    const result = parseGS1WithParentheses(cleaned);
    if (result) {
      return result;
    }
  }
  
  // Fallback: Parse ohne Klammern (raw GS1 format)
  const result: GS1Data = { raw: barcode };
  let normalized = cleaned;
  
  // FNC1-Zeichen als Feldtrennzeichen markieren (Group Separator)
  // GS1 verwendet FNC1 (\x1D, ASCII 29) oder ~ als Trennzeichen zwischen variablen Feldern
  
  // Manche Scanner geben FNC1 als literale Zeichenkette "x1d" oder "\x1d" aus
  // z.B. "x1d0108714729158608..." statt dem echten ASCII 29 Zeichen
  // Entferne "x1d" am Anfang (GS1-Präfix) und ersetze innerhalb durch GS-Zeichen
  if (normalized.toLowerCase().startsWith('x1d')) {
    normalized = normalized.substring(3);
  }
  // Auch \x1d als literale Zeichenkette (4 Zeichen) behandeln
  if (normalized.toLowerCase().startsWith('\\x1d')) {
    normalized = normalized.substring(4);
  }
  // x1d innerhalb des Strings durch echtes GS-Zeichen ersetzen (case-insensitive)
  normalized = normalized.replace(/x1d/gi, '\x1D');
  normalized = normalized.replace(/\\x1d/gi, '\x1D');
  
  // eslint-disable-next-line no-control-regex
  normalized = normalized.replace(/\x1D/g, '\x1D'); // Behalte GS-Zeichen
  
  // AIM Symbology Identifier entfernen (]C1, ]E0, ]d2 etc.)
  if (normalized.startsWith(']')) {
    // Entferne ]XX am Anfang (3 Zeichen)
    normalized = normalized.substring(3);
  }
  
  // Alternative FNC1-Darstellungen durch echtes GS-Zeichen ersetzen
  normalized = normalized.replace(/~|␝/g, '\x1D');
  
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
      // Variable Länge - bis zum GS-Zeichen, nächsten AI oder Ende
      let endPos = position;
      while (endPos < normalized.length) {
        // GS-Zeichen (FNC1) beendet das variable Feld
        if (normalized.charAt(endPos) === '\x1D') {
          break;
        }
        // Prüfe ob an dieser Position ein neuer AI beginnt
        let foundNextAI = false;
        for (let len = 2; len <= 4; len++) {
          const testAI = normalized.substring(endPos, endPos + len);
          if (AI_PATTERNS[testAI]) {
            // Zusätzliche Validierung: Prüfe ob nach dem AI genug Zeichen für gültige Daten folgen
            const aiPattern = AI_PATTERNS[testAI];
            const remainingAfterAI = normalized.length - endPos - len;
            
            // Für AIs mit fester Länge: muss genug Zeichen haben
            if (aiPattern.length !== null && remainingAfterAI < aiPattern.length) {
              // Nicht genug Zeichen für diesen AI - ignorieren
              continue;
            }
            // Für AIs mit variabler Länge: mindestens 1 Zeichen
            if (aiPattern.length === null && remainingAfterAI < 1) {
              continue;
            }
            
            foundNextAI = true;
            break;
          }
        }
        if (foundNextAI) break;
        endPos++;
      }
      value = normalized.substring(position, endPos);
      position = endPos;
      // GS-Zeichen überspringen falls vorhanden
      if (position < normalized.length && normalized.charAt(position) === '\x1D') {
        position++;
      }
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
  
  // Leerzeichen entfernen
  const cleaned = barcode.replace(/\s+/g, '');
  
  // Mindestlänge prüfen (AI + Daten)
  if (cleaned.length < 4) return false;
  
  // Klammern-Format prüfen: (01)... oder (10)... etc.
  const parenthesesMatch = cleaned.match(/^\((\d{2,4})\)/);
  if (parenthesesMatch) {
    const ai = parenthesesMatch[1];
    if (AI_PATTERNS[ai]) {
      return true;
    }
  }
  
  // Normalisieren
  let normalized = cleaned;
  
  // x1d Präfix entfernen (manche Scanner geben FNC1 so aus)
  if (normalized.toLowerCase().startsWith('x1d')) {
    normalized = normalized.substring(3);
  }
  if (normalized.toLowerCase().startsWith('\\x1d')) {
    normalized = normalized.substring(4);
  }
  
  // eslint-disable-next-line no-control-regex
  normalized = normalized.replace(/\]C1|~|\x1D|x1d/gi, '');
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
