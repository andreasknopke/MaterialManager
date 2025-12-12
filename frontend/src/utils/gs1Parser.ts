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
 * Entfernt Klammern um Application Identifiers und normalisiert den Barcode
 * z.B. "(01)08714729158608(17)280806(10)37152429" → "010871472915860817280806103715242"
 * Die Klammern dienen als visuelle Trennung und werden von manchen Scannern beibehalten
 */
function normalizeGS1WithParentheses(barcode: string): string {
  // Prüfe ob der Barcode Klammern enthält - Format: (AI)value
  if (!barcode.includes('(')) {
    return barcode;
  }
  
  // Regex um (XX) oder (XXX) oder (XXXX) zu finden, gefolgt von Daten
  // Die Klammern markieren den AI, der Wert folgt direkt danach
  let result = '';
  let remaining = barcode;
  
  // Pattern: (AI)value wobei AI 2-4 Ziffern ist
  const aiPattern = /^\((\d{2,4})\)(.*)$/;
  
  while (remaining.length > 0) {
    const match = remaining.match(aiPattern);
    if (match) {
      const ai = match[1];
      remaining = match[2];
      
      // Füge AI ohne Klammern hinzu
      result += ai;
      
      // Finde den Wert bis zur nächsten Klammer oder Ende
      const nextParenPos = remaining.indexOf('(');
      if (nextParenPos === -1) {
        // Keine weitere Klammer, Rest ist der Wert
        result += remaining;
        remaining = '';
      } else {
        // Wert bis zur nächsten Klammer
        // WICHTIG: Füge GS-Zeichen als Trenner hinzu, damit der Parser weiß wo das Feld endet
        result += remaining.substring(0, nextParenPos) + '\x1D';
        remaining = remaining.substring(nextParenPos);
      }
    } else {
      // Kein Klammer-Pattern mehr gefunden, Rest anhängen
      result += remaining;
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

  const result: GS1Data = { raw: barcode };
  
  // Zuerst Klammern um AIs entfernen falls vorhanden
  // z.B. "(01)08714729158608(17)280806(10)37152429" → "0108714729158608172808061037152429"
  let normalized = normalizeGS1WithParentheses(barcode);
  
  // FNC1-Zeichen als Feldtrennzeichen markieren (Group Separator)
  // GS1 verwendet FNC1 (\x1D, ASCII 29) oder ~ als Trennzeichen zwischen variablen Feldern
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
  
  // Mindestlänge prüfen (AI + Daten)
  if (barcode.length < 4) return false;
  
  // Klammern-Format prüfen: (01)... oder (10)... etc.
  const parenthesesMatch = barcode.match(/^\((\d{2,4})\)/);
  if (parenthesesMatch) {
    const ai = parenthesesMatch[1];
    if (AI_PATTERNS[ai]) {
      return true;
    }
  }
  
  // Normalisieren (Klammern entfernen falls vorhanden)
  let normalized = normalizeGS1WithParentheses(barcode);
  
  // eslint-disable-next-line no-control-regex
  normalized = normalized.replace(/\]C1|~|\x1D/g, '');
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
