import { Mistral } from '@mistralai/mistralai';

export interface ProductSuggestion {
  name: string;
  description?: string;
  category?: string;
  company?: string;
  estimatedCost?: number;
  confidence: number;
}

export class MistralService {
  private client: Mistral | null = null;

  constructor() {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (apiKey) {
      this.client = new Mistral({ apiKey });
    } else {
      console.warn('MISTRAL_API_KEY nicht gesetzt. KI-Features deaktiviert.');
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  /**
   * Generiert Produktvorschläge basierend auf einer Beschreibung oder Anfrage
   */
  async generateProductSuggestions(
    query: string,
    existingProducts: string[] = [],
    context?: {
      categories?: string[];
      companies?: string[];
      recentMaterials?: string[];
    }
  ): Promise<ProductSuggestion[]> {
    if (!this.client) {
      throw new Error('Mistral API ist nicht konfiguriert');
    }

    const systemPrompt = `Du bist ein Experte für medizinisches Material in der Angiographie und Kardiologie. 
Deine Aufgabe ist es, präzise Produktvorschläge zu machen basierend auf Benutzeranfragen.

Kontext:
- Vorhandene Produkte: ${existingProducts.length > 0 ? existingProducts.slice(0, 20).join(', ') : 'keine'}
${context?.categories ? `- Kategorien: ${context.categories.join(', ')}` : ''}
${context?.companies ? `- Hersteller: ${context.companies.join(', ')}` : ''}
${context?.recentMaterials ? `- Kürzlich verwendete Materialien: ${context.recentMaterials.slice(0, 10).join(', ')}` : ''}

Antworte AUSSCHLIESSLICH im folgenden JSON-Format (ohne Markdown, ohne zusätzlichen Text):
[
  {
    "name": "Produktname",
    "description": "Kurze Beschreibung",
    "category": "Kategorie (falls erkennbar)",
    "company": "Hersteller (falls erkennbar)",
    "estimatedCost": 0,
    "confidence": 0.95
  }
]

Gib 1-5 relevante Vorschläge zurück. Sortiere nach Relevanz (höchste zuerst).`;

    const userPrompt = `Benutzeranfrage: "${query}"

Erstelle passende Produktvorschläge für diese Anfrage. Berücksichtige dabei medizinische Standards und gängige Bezeichnungen in der Angiographie.`;

    try {
      const chatResponse = await this.client.chat.complete({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        maxTokens: 2000
      });

      const content = chatResponse.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Keine Antwort von Mistral erhalten');
      }

      // Parse JSON response - content ist entweder string oder ContentChunk[]
      const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
      const suggestions = JSON.parse(contentStr.trim());
      
      if (!Array.isArray(suggestions)) {
        throw new Error('Ungültiges Antwortformat');
      }

      return suggestions.map((s: any) => ({
        name: s.name || '',
        description: s.description,
        category: s.category,
        company: s.company,
        estimatedCost: s.estimatedCost,
        confidence: s.confidence || 0.5
      }));
    } catch (error) {
      console.error('Fehler bei Mistral API-Aufruf:', error);
      throw error;
    }
  }

  /**
   * Analysiert einen Barcode oder Text und schlägt passende Produktinformationen vor
   */
  async analyzeBarcode(
    barcode: string,
    scannedText?: string
  ): Promise<ProductSuggestion | null> {
    if (!this.client) {
      throw new Error('Mistral API ist nicht konfiguriert');
    }

    const systemPrompt = `Du bist ein Experte für medizinische Barcodes (insbesondere GS1) und Produktidentifikation.
Analysiere den gegebenen Barcode/Text und extrahiere Produktinformationen.

Antworte AUSSCHLIESSLICH im folgenden JSON-Format (ohne Markdown):
{
  "name": "Produktname",
  "description": "Beschreibung",
  "category": "Kategorie",
  "company": "Hersteller",
  "confidence": 0.8
}

Falls keine sinnvollen Informationen extrahiert werden können, antworte mit: null`;

    const userPrompt = `Barcode: ${barcode}
${scannedText ? `Gescannter Text: ${scannedText}` : ''}

Analysiere diese Daten und schlage Produktinformationen vor.`;

    try {
      const chatResponse = await this.client.chat.complete({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        maxTokens: 500
      });

      const rawContent = chatResponse.choices?.[0]?.message?.content;
      if (!rawContent) {
        return null;
      }

      const content = (typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)).trim();
      if (content === 'null') {
        return null;
      }

      const suggestion = JSON.parse(content);
      return {
        name: suggestion.name || '',
        description: suggestion.description,
        category: suggestion.category,
        company: suggestion.company,
        estimatedCost: suggestion.estimatedCost,
        confidence: suggestion.confidence || 0.5
      };
    } catch (error) {
      console.error('Fehler bei Barcode-Analyse:', error);
      throw error;
    }
  }

  /**
   * Intelligente Vervollständigung für Produkteingaben
   */
  async autocompleteProduct(
    partialInput: string,
    existingProducts: string[] = []
  ): Promise<string[]> {
    if (!this.client) {
      throw new Error('Mistral API ist nicht konfiguriert');
    }

    const systemPrompt = `Du bist ein Autocomplete-System für medizinische Produkte in der Angiographie.
Gegeben eine partielle Eingabe, schlage 3-5 vollständige Produktnamen vor.

Kontext - Vorhandene Produkte: ${existingProducts.slice(0, 50).join(', ')}

Antworte AUSSCHLIESSLICH als JSON-Array mit Strings (ohne Markdown):
["Produktname 1", "Produktname 2", "Produktname 3"]`;

    const userPrompt = `Eingabe: "${partialInput}"

Schlage passende vollständige Produktnamen vor.`;

    try {
      const chatResponse = await this.client.chat.complete({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        maxTokens: 300
      });

      const rawContent = chatResponse.choices?.[0]?.message?.content;
      if (!rawContent) {
        return [];
      }

      const content = (typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)).trim();
      if (!content) {
        return [];
      }

      const suggestions = JSON.parse(content);
      return Array.isArray(suggestions) ? suggestions : [];
    } catch (error) {
      console.error('Fehler bei Autocomplete:', error);
      return [];
    }
  }

  /**
   * Durchsucht eine Webseite nach Produkten mit identischen Eigenschaften
   */
  async lookupSimilarProducts(
    websiteContent: string,
    targetProperties: {
      deviceLength?: string;
      shaftLength?: string;
      frenchSize?: string;
      diameter?: string;
      shapeName?: string;
    }
  ): Promise<Array<{
    name: string;
    properties: {
      deviceLength?: string;
      shaftLength?: string;
      frenchSize?: string;
      diameter?: string;
      shapeName?: string;
    };
    matchScore: number;
    additionalInfo?: string;
  }>> {
    if (!this.client) {
      throw new Error('Mistral API ist nicht konfiguriert');
    }

    const propertiesStr = Object.entries(targetProperties)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    const systemPrompt = `Du bist ein Experte für medizinische Produkte in der Angiographie und Kardiologie.
Deine Aufgabe ist es, eine Produkttabelle auf einer Webseite zu analysieren und Produkte zu finden, die IDENTISCHE oder SEHR ÄHNLICHE Eigenschaften haben wie das Zielprodukt.

Wichtig:
- Suche nach Produkten in Tabellen oder strukturierten Listen
- Vergleiche die folgenden Eigenschaften: Device-Länge, Schaftlänge, French-Size, Durchmesser, Shape/Form
- Ein Match ist relevant, wenn mindestens 3 der 4 Haupteigenschaften (außer Shape) übereinstimmen
- Achte auf verschiedene Schreibweisen (z.B. "Fr", "F", "French", "CH")
- Berücksichtige auch Toleranzen (z.B. 6F und 6Fr sind identisch)

Antworte AUSSCHLIESSLICH im folgenden JSON-Format (ohne Markdown):
[
  {
    "name": "Produktname",
    "properties": {
      "deviceLength": "Wert mit Einheit",
      "shaftLength": "Wert mit Einheit",
      "frenchSize": "Wert",
      "diameter": "Wert mit Einheit",
      "shapeName": "Name der Form"
    },
    "matchScore": 0.95,
    "additionalInfo": "Weitere relevante Informationen"
  }
]

matchScore: 1.0 = perfekte Übereinstimmung, 0.75-0.99 = sehr ähnlich, 0.5-0.74 = ähnlich
Gib nur Produkte mit matchScore >= 0.75 zurück.`;

    const userPrompt = `Zielprodukt-Eigenschaften:
${propertiesStr}

Webseiten-Inhalt (Auszug):
${websiteContent.substring(0, 15000)}

Finde alle Produkte mit identischen oder sehr ähnlichen Eigenschaften und gib sie als JSON zurück.`;

    try {
      const chatResponse = await this.client.chat.complete({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        maxTokens: 4000
      });

      const rawContent = chatResponse.choices?.[0]?.message?.content;
      if (!rawContent) {
        return [];
      }

      const content = (typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)).trim();
      
      // Versuche JSON zu extrahieren, falls es in Markdown-Code-Blöcke eingebettet ist
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const results = JSON.parse(jsonContent);
      
      if (!Array.isArray(results)) {
        console.warn('Ungültiges Antwortformat von Mistral');
        return [];
      }

      return results;
    } catch (error) {
      console.error('Fehler bei Product Lookup:', error);
      throw error;
    }
  }

  /**
   * Analysiert ein Foto eines Materialschranks und vergleicht es mit der Materialliste
   */
  async analyzeInventoryPhoto(
    imageBase64: string,
    materialList: Array<{
      compartmentName: string;
      materials: Array<{
        name: string;
        quantity: number;
        articleNumber?: string;
      }>;
    }>
  ): Promise<{
    overallMatch: number;
    analysis: string;
    compartmentResults: Array<{
      compartmentName: string;
      matchProbability: number;
      notes: string;
    }>;
    discrepancies: string[];
    recommendations: string[];
  }> {
    if (!this.client) {
      throw new Error('Mistral API ist nicht konfiguriert');
    }

    // Erstelle formatierte Materialliste für den Prompt
    const formattedList = materialList.map(comp => {
      const materialStr = comp.materials
        .map(m => `  - ${m.name}: ${m.quantity} Stück${m.articleNumber ? ` (Art.-Nr.: ${m.articleNumber})` : ''}`)
        .join('\n');
      return `Fach "${comp.compartmentName}":\n${materialStr || '  (leer)'}`;
    }).join('\n\n');

    const systemPrompt = `Du bist ein Experte für die visuelle Inventurprüfung von Materialschränken in medizinischen Einrichtungen.

Deine Aufgabe:
1. Analysiere das Foto des Materialschranks
2. Vergleiche den sichtbaren Inhalt mit der bereitgestellten Materialliste
3. Schätze für jedes Fach die Wahrscheinlichkeit, dass der Inhalt mit der Liste übereinstimmt
4. Identifiziere mögliche Diskrepanzen

Hinweise:
- Du kannst oft keine genauen Produktnamen ablesen, aber du kannst Verpackungsgrößen, Farben und Mengen abschätzen
- Achte auf leere Fächer vs. befüllte Fächer
- Schätze bei jedem Fach: "stimmt überein", "wahrscheinlich korrekt", "möglicherweise abweichend", "deutlich abweichend"
- Gib konkrete Beobachtungen an

Antworte AUSSCHLIESSLICH im folgenden JSON-Format (ohne Markdown):
{
  "overallMatch": 0.85,
  "analysis": "Zusammenfassende Analyse des Schrankinhalts",
  "compartmentResults": [
    {
      "compartmentName": "Name des Fachs",
      "matchProbability": 0.9,
      "notes": "Beobachtungen zu diesem Fach"
    }
  ],
  "discrepancies": ["Liste erkannter Abweichungen"],
  "recommendations": ["Empfehlungen für die manuelle Nachprüfung"]
}`;

    const userPrompt = `Bitte analysiere dieses Foto eines Materialschranks und vergleiche es mit der folgenden Materialliste:

MATERIALLISTE (nach Fächern sortiert):
${formattedList}

Überprüfe das Foto und gib an:
1. Wie wahrscheinlich ist es, dass der Inhalt zahlenmäßig der Auflistung entspricht?
2. Welche Fächer sehen korrekt befüllt aus?
3. Wo könnten Abweichungen bestehen?

Du kannst vielleicht keine genauen Daten ablesen, aber du kannst eine Wahrscheinlichkeit angeben, ob es sich um das jeweilige Produkt handelt oder nicht.`;

    try {
      const chatResponse = await this.client.chat.complete({
        model: 'pixtral-large-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: userPrompt },
              { 
                type: 'image_url', 
                imageUrl: imageBase64.startsWith('data:') 
                  ? imageBase64 
                  : `data:image/jpeg;base64,${imageBase64}`
              }
            ]
          }
        ],
        temperature: 0.2,
        maxTokens: 4000
      });

      const rawContent = chatResponse.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new Error('Keine Antwort von Mistral erhalten');
      }

      const content = (typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)).trim();
      
      // Versuche JSON zu extrahieren, falls es in Markdown-Code-Blöcke eingebettet ist
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const result = JSON.parse(jsonContent);
      
      return {
        overallMatch: result.overallMatch || 0,
        analysis: result.analysis || 'Keine Analyse verfügbar',
        compartmentResults: result.compartmentResults || [],
        discrepancies: result.discrepancies || [],
        recommendations: result.recommendations || []
      };
    } catch (error) {
      console.error('Fehler bei Inventur-Foto-Analyse:', error);
      throw error;
    }
  }
}

// Singleton-Instanz
export const mistralService = new MistralService();
