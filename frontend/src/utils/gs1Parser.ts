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
 * Konvertiert ein GS1-Datum (YYMMDD oder YYMM) in ISO-Format (YYYY-MM-DD)
 * Unterstützt auch 4-stellige Daten (YYMM) ohne Tag
 */
function parseGS1Date(gs1Date: string): string | null {
  if (!gs1Date) return null;
  
  // 6-stelliges Format: YYMMDD
  if (gs1Date.length === 6) {
    const yy = gs1Date.substring(0, 2);
    const mm = gs1Date.substring(2, 4);
    const dd = gs1Date.substring(4, 6);
    const year = 2000 + parseInt(yy, 10);
    // Tag "00" bedeutet: letzter Tag des Monats (GS1 Standard)
    const day = dd === '00' ? '01' : dd;
    return `${year}-${mm}-${day}`;
  }
  
  // 4-stelliges Format: YYMM (ohne Tag) - setze Tag auf 01
  if (gs1Date.length === 4) {
    const yy = gs1Date.substring(0, 2);
    const mm = gs1Date.substring(2, 4);
    const year = 2000 + parseInt(yy, 10);
    return `${year}-${mm}-01`;
  }
  
  return null;
}

/**
 * Parst einen GS1 Barcode und extrahiert die relevanten Daten
 * @param barcode Der zu parsende Barcode (kann FNC1 als "~" oder "]" enthalten, sowie Klammern um AIs)
 * @returns Geparste GS1-Daten
 */
export function parseGS1Barcode(barcode: string): GS1Data {
  console.log('=== GS1 PARSER DEBUG START ===');
  console.log('Input Barcode:', barcode);
  console.log('Input Länge:', barcode?.length);
  console.log('Input Hex:', barcode ? Array.from(barcode).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ') : 'null');
  
  if (!barcode) {
    console.log('Barcode ist leer/null');
    return { raw: barcode };
  }

  // Alle Leerzeichen entfernen (Scanner fügt manchmal Leerzeichen ein)
  let cleaned = barcode.replace(/\s+/g, '');
  console.log('Nach Leerzeichen-Entfernung:', cleaned);
  
  // Steuerzeichen am Anfang entfernen (FNC1 = ASCII 29, aber auch andere Steuerzeichen)
  // Diese werden oft von Scannern als Prefix gesendet
  while (cleaned.length > 0 && cleaned.charCodeAt(0) < 32) {
    console.log('Steuerzeichen am Anfang entfernt: ASCII', cleaned.charCodeAt(0));
    cleaned = cleaned.substring(1);
  }
  console.log('Nach Steuerzeichen-Entfernung:', cleaned);
  
  // Wenn der Barcode Klammern enthält, parse ihn direkt mit Klammern als Feldgrenzen
  // Dies ist die zuverlässigste Methode, da die Klammern exakte Feldgrenzen definieren
  if (cleaned.includes('(')) {
    console.log('Klammern-Format erkannt, nutze parseGS1WithParentheses');
    const result = parseGS1WithParentheses(cleaned);
    if (result) {
      console.log('Klammern-Parse Ergebnis:', JSON.stringify(result, null, 2));
      console.log('=== GS1 PARSER DEBUG END ===');
      return result;
    }
  }
  console.log('Kein Klammern-Format, nutze Raw-Parser');
  
  // Fallback: Parse ohne Klammern (raw GS1 format)
  const result: GS1Data = { raw: barcode };
  let normalized = cleaned;
  
  console.log('Vor Normalisierung:', normalized);
  
  // FNC1-Zeichen als Feldtrennzeichen markieren (Group Separator)
  // GS1 verwendet FNC1 (\x1D, ASCII 29) oder ~ als Trennzeichen zwischen variablen Feldern
  
  // Manche Scanner geben FNC1 als literale Zeichenkette "x1d" oder "\x1d" aus
  // z.B. "x1d0108714729158608..." statt dem echten ASCII 29 Zeichen
  // Entferne "x1d" am Anfang (GS1-Präfix) und ersetze innerhalb durch GS-Zeichen
  if (normalized.toLowerCase().startsWith('x1d')) {
    console.log('x1d Präfix entfernt');
    normalized = normalized.substring(3);
  }
  // Auch \x1d als literale Zeichenkette (4 Zeichen) behandeln
  if (normalized.toLowerCase().startsWith('\\x1d')) {
    console.log('\\x1d Präfix entfernt');
    normalized = normalized.substring(4);
  }
  // x1d innerhalb des Strings durch echtes GS-Zeichen ersetzen (case-insensitive)
  normalized = normalized.replace(/x1d/gi, '\x1D');
  normalized = normalized.replace(/\\x1d/gi, '\x1D');
  
  // eslint-disable-next-line no-control-regex
  normalized = normalized.replace(/\x1D/g, '\x1D'); // Behalte GS-Zeichen
  
  // AIM Symbology Identifier entfernen (]C1, ]E0, ]d2 etc.)
  if (normalized.startsWith(']')) {
    console.log('AIM Symbology Identifier entfernt:', normalized.substring(0, 3));
    // Entferne ]XX am Anfang (3 Zeichen)
    normalized = normalized.substring(3);
  }
  
  // Alternative FNC1-Darstellungen durch echtes GS-Zeichen ersetzen
  normalized = normalized.replace(/~|␝/g, '\x1D');
  
  console.log('Nach Normalisierung:', normalized);
  console.log('Nach Normalisierung Hex:', Array.from(normalized).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '));
  console.log('Normalisiert Länge:', normalized.length);
  
  let position = 0;
  let iterationCount = 0;
  
  console.log('--- Starte AI-Parsing Loop ---');
  
  while (position < normalized.length) {
    iterationCount++;
    console.log(`\n--- Iteration ${iterationCount}, Position ${position} ---`);
    console.log('Verbleibender String:', normalized.substring(position));
    
    // Nächsten AI (2-4 Zeichen) suchen
    let ai: string | null = null;
    let aiLength = 0;
    
    // Versuche 4-stelligen, dann 3-stelligen, dann 2-stelligen AI
    for (let len = 4; len >= 2; len--) {
      const testAI = normalized.substring(position, position + len);
      console.log(`  Teste AI Länge ${len}: "${testAI}"`);
      if (AI_PATTERNS[testAI]) {
        ai = testAI;
        aiLength = len;
        console.log(`  -> AI gefunden: ${ai} (${AI_PATTERNS[ai].name})`);
        break;
      }
    }
    
    if (!ai) {
      // Kein bekannter AI gefunden, abbrechen
      console.log('Kein bekannter AI gefunden, beende Loop');
      break;
    }
    
    position += aiLength;
    const pattern = AI_PATTERNS[ai];
    console.log(`AI ${ai}: Erwartete Länge = ${pattern.length === null ? 'variabel' : pattern.length}`);
    
    let value: string;
    
    if (pattern.length !== null) {
      // Feste Länge - bei Datums-AIs (11, 17) auch kürzere Formate erlauben
      // da manche Hersteller YYMM statt YYMMDD verwenden
      const isDateAI = (ai === '11' || ai === '17');
      console.log(`Feste Länge, isDateAI: ${isDateAI}`);
      
      if (isDateAI) {
        // Bei Datums-AIs: Prüfe ob ein neuer AI vor der vollen Länge beginnt
        // Manche Hersteller verwenden YYMM (4 Zeichen) statt YYMMDD (6 Zeichen)
        // Problem: z.B. "(01)...(11)2507(17)280716(21)..." - hier ist "17" ein AI, nicht Teil des Datums!
        const maxEndPos = Math.min(position + pattern.length, normalized.length);
        console.log(`Datums-AI: Suche Ende von Position ${position} bis maximal ${maxEndPos}`);
        
        // Default: volle Länge (6 Zeichen für YYMMDD)
        let endPos = maxEndPos;
        
        // Intelligente Heuristik für verkürzte Datums-AIs:
        // Prüfe ob an Position+4 ein AI beginnt UND danach gültige Daten folgen
        const hasFullDate = (normalized.length >= position + 6);
        
        if (!hasFullDate && position + 4 <= normalized.length) {
          // Nicht genug Zeichen für volles Datum - verwende was verfügbar ist
          console.log(`  Nicht genug Zeichen für YYMMDD, verwende verfügbare ${normalized.length - position} Zeichen`);
          endPos = normalized.length;
        } else if (hasFullDate) {
          // Prüfe an Position+4 ob ein gültiger AI folgt
          // Dies ermöglicht YYMM-Format (4 Zeichen) wenn danach ein AI mit gültigen Daten kommt
          const fullDate = normalized.substring(position, position + 6);
          console.log(`  Potentielles 6-stelliges Datum: "${fullDate}"`);
          
          // Prüfe ob Zeichen 4-5 ein bekannter AI sein könnten
          const potentialAI = fullDate.substring(4, 6);
          console.log(`  Zeichen 4-5 (potentieller AI): "${potentialAI}"`);
          
          if (AI_PATTERNS[potentialAI]) {
            // Gefunden! Aber ist es wirklich ein AI oder Teil des Datums?
            // Prüfe ob danach gültige Daten für diesen AI-Typ folgen
            const afterAIPos = position + 6;
            const afterAI = normalized.substring(afterAIPos);
            console.log(`  Nach potentiellem AI ${potentialAI}: "${afterAI.substring(0, 15)}..."`);
            
            let isValidNextAI = false;
            
            if (potentialAI === '17' || potentialAI === '11') {
              // Nächster AI ist auch ein Datums-AI - prüfe ob YYMMDD-Format gültig ist
              if (afterAI.length >= 6) {
                const yy = parseInt(afterAI.substring(0, 2), 10);
                const mm = parseInt(afterAI.substring(2, 4), 10);
                const dd = parseInt(afterAI.substring(4, 6), 10);
                console.log(`  Parsing als Datum: YY=${yy}, MM=${mm}, DD=${dd}`);
                // Plausibilitätsprüfung: Jahr 2020-2050, Monat 1-12, Tag 0-31
                if (yy >= 20 && yy <= 50 && mm >= 1 && mm <= 12 && dd >= 0 && dd <= 31) {
                  console.log(`  -> Gültiges Datum erkannt! AI ${potentialAI} ist ein echter AI.`);
                  isValidNextAI = true;
                }
              }
            } else if (potentialAI === '21' || potentialAI === '10') {
              // Variable-Länge AI (Serial, Batch) - muss mindestens 1 Zeichen Daten haben
              if (afterAI.length >= 1) {
                console.log(`  -> AI ${potentialAI} mit Daten erkannt`);
                isValidNextAI = true;
              }
            } else {
              // Andere AIs mit fester Länge
              const nextPattern = AI_PATTERNS[potentialAI];
              if (nextPattern.length !== null && afterAI.length >= nextPattern.length) {
                isValidNextAI = true;
              } else if (nextPattern.length === null && afterAI.length >= 1) {
                isValidNextAI = true;
              }
            }
            
            if (isValidNextAI) {
              console.log(`  -> Verwende 4-Zeichen-Datum (YYMM), AI ${potentialAI} folgt`);
              endPos = position + 4;
            }
          }
        }
        
        value = normalized.substring(position, endPos);
        console.log(`Datums-AI Wert extrahiert: "${value}" (Länge ${value.length})`);
        position = endPos;
      } else {
        // Normale feste Länge (GTIN, SSCC etc.) - volle Länge verwenden
        value = normalized.substring(position, position + pattern.length);
        console.log(`Feste Länge Wert extrahiert: "${value}" (Länge ${value.length})`);
        position += pattern.length;
      }
    } else {
      // Variable Länge - bis zum GS-Zeichen, nächsten AI oder Ende
      console.log(`Variable Länge AI ${ai} ab Position ${position}`);
      
      // SPEZIALFALL für variable AIs (10, 21):
      // Diese Felder können intern Ziffernfolgen haben, die wie AIs aussehen
      // z.B. LOT "250210A" enthält "21" und "10" als Substrings
      // 
      // GS1-Standard: FNC1 (ASCII 29) trennt variable Felder
      // Ohne FNC1 können wir nicht sicher sagen, wo das Feld endet
      // 
      // Heuristik: 
      // - Bei AI 21 (Serial): Fast immer das letzte Feld → bis Ende lesen
      // - Bei AI 10 (Batch/Lot) NACH AI 17: Auch typischerweise letztes Feld
      // - Nur bei echtem GS-Zeichen (ASCII 29) oder sicherem AI stoppen
      const isSerialAI = (ai === '21');
      const isBatchAI = (ai === '10');
      
      // Batch/Lot nach Datum ist typischerweise das letzte Feld
      // (Reihenfolge: 01-GTIN, 17-Datum, 10-LOT)
      const isBatchAfterDate = isBatchAI && result.expiryDate;
      
      let endPos = position;
      while (endPos < normalized.length) {
        // GS-Zeichen (FNC1) beendet das variable Feld - immer respektieren
        if (normalized.charAt(endPos) === '\x1D') {
          console.log(`GS-Zeichen gefunden an Position ${endPos}`);
          break;
        }
        
        // Bei Serial Number (AI 21): Keine AI-Suche innerhalb der Daten
        // Serial ist fast immer das letzte Feld im GS1-Barcode
        if (isSerialAI) {
          endPos++;
          continue;
        }
        
        // Bei Batch/Lot (AI 10) nach Datum: Auch bis zum Ende lesen
        // Dies verhindert, dass "21" in "250210A" als AI interpretiert wird
        if (isBatchAfterDate) {
          endPos++;
          continue;
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
            
            // Zusätzliche Prüfung: Wenn wir in AI 10 sind und "21" finden,
            // prüfe ob der verbleibende Rest plausibel als Seriennummer aussieht
            // Eine Seriennummer sollte typischerweise mindestens 5 Zeichen haben
            if (ai === '10' && testAI === '21') {
              const potentialSerial = normalized.substring(endPos + len);
              // Wenn der verbleibende "Serial" Teil sehr kurz ist (< 5 Zeichen)
              // und alphanumerisch endet, ist es wahrscheinlich Teil der LOT
              if (potentialSerial.length < 5 && /[A-Za-z]$/.test(potentialSerial)) {
                console.log(`  -> "21" in LOT gefunden, aber Rest "${potentialSerial}" zu kurz/alphanumerisch - überspringe`);
                continue;
              }
            }
            
            console.log(`  -> Nächster AI gefunden an Position ${endPos}: ${testAI}`);
            foundNextAI = true;
            break;
          }
        }
        if (foundNextAI) break;
        endPos++;
      }
      value = normalized.substring(position, endPos);
      console.log(`Variable Länge Wert extrahiert: "${value}" (Länge ${value.length})`);
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
    console.log(`Aktuelles Ergebnis:`, JSON.stringify(result, null, 2));
  }
  
  console.log('\n=== FINALES ERGEBNIS ===');
  console.log(JSON.stringify(result, null, 2));
  console.log('=== GS1 PARSER DEBUG END ===');
  
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
