# Mistral AI Integration

## Übersicht

Das Material Manager System integriert Mistral Large für KI-gestützte Funktionen:

- **Produktvorschläge**: Intelligente Vorschläge basierend auf Textabfragen
- **Barcode-Analyse**: Automatische Produkterkennung aus Barcodes
- **Autocomplete**: KI-basierte Vervollständigung von Produktnamen

## Installation

1. **Dependencies installieren**:
```bash
cd backend
npm install
```

2. **API-Key konfigurieren**:
   - Erhalten Sie einen API-Key von [Mistral AI Console](https://console.mistral.ai/)
   - Fügen Sie den Key zur `.env` Datei hinzu:
```env
MISTRAL_API_KEY=your_mistral_api_key_here
```

3. **Backend neu starten**:
```bash
npm run dev
```

## API-Endpunkte

### Status überprüfen

```http
GET /api/ai/status
```

**Response**:
```json
{
  "enabled": true,
  "model": "mistral-large-latest",
  "features": {
    "productSuggestions": true,
    "barcodeAnalysis": true,
    "autocomplete": true
  }
}
```

### Produktvorschläge generieren

```http
POST /api/ai/suggest-products
Content-Type: application/json
Authorization: Bearer <token>

{
  "query": "Katheter für Koronarangiographie",
  "includeContext": true
}
```

**Response**:
```json
{
  "query": "Katheter für Koronarangiographie",
  "suggestions": [
    {
      "name": "JR4 Diagnostikkatheter 6F",
      "description": "Judkins Right Katheter für rechte Koronararterie",
      "category": "Katheter",
      "company": "Cordis",
      "estimatedCost": 45.00,
      "confidence": 0.95
    },
    {
      "name": "JL4 Diagnostikkatheter 6F",
      "description": "Judkins Left Katheter für linke Koronararterie",
      "category": "Katheter",
      "company": "Cordis",
      "estimatedCost": 45.00,
      "confidence": 0.93
    }
  ],
  "timestamp": "2026-01-02T10:30:00.000Z"
}
```

### Barcode analysieren

```http
POST /api/ai/analyze-barcode
Content-Type: application/json
Authorization: Bearer <token>

{
  "barcode": "4046719123456",
  "scannedText": "JR4 6F Cordis"
}
```

**Response**:
```json
{
  "barcode": "4046719123456",
  "found": true,
  "suggestion": {
    "name": "JR4 Diagnostikkatheter 6F",
    "description": "Judkins Right Katheter für diagnostische Koronarangiographie",
    "category": "Katheter",
    "company": "Cordis",
    "confidence": 0.88
  },
  "timestamp": "2026-01-02T10:31:00.000Z"
}
```

### Autocomplete

```http
POST /api/ai/autocomplete
Content-Type: application/json
Authorization: Bearer <token>

{
  "input": "Guidewire 0"
}
```

**Response**:
```json
{
  "input": "Guidewire 0",
  "suggestions": [
    "Guidewire 0.014\" 180cm",
    "Guidewire 0.035\" 150cm",
    "Guidewire 0.018\" 200cm"
  ],
  "timestamp": "2026-01-02T10:32:00.000Z"
}
```

## Verwendung im Frontend

### React Hook Beispiel

```typescript
import { useState } from 'react';

export const useAiSuggestions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSuggestions = async (query: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/ai/suggest-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ query, includeContext: true })
      });

      if (!response.ok) {
        throw new Error('Fehler beim Abrufen der Vorschläge');
      }

      const data = await response.json();
      return data.suggestions;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { getSuggestions, loading, error };
};
```

### Autocomplete Komponente

```tsx
import { useState, useEffect } from 'react';

export const AiAutocomplete = ({ onSelect }) => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (input.length < 2) {
        setSuggestions([]);
        return;
      }

      const response = await fetch('/api/ai/autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ input })
      });

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [input]);

  return (
    <div>
      <input 
        value={input} 
        onChange={(e) => setInput(e.target.value)}
        placeholder="Produktname eingeben..."
      />
      {suggestions.length > 0 && (
        <ul>
          {suggestions.map((suggestion, idx) => (
            <li key={idx} onClick={() => onSelect(suggestion)}>
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

## Konfiguration

### Umgebungsvariablen

```env
# Erforderlich für KI-Features
MISTRAL_API_KEY=your_mistral_api_key_here
```

### Optional: Custom Prompts

Die KI-Prompts können in [backend/src/services/mistral.service.ts](backend/src/services/mistral.service.ts) angepasst werden.

## Kosten & Rate Limits

- Mistral Large verwendet ein Token-basiertes Preismodell
- Aktuelle Preise: [Mistral AI Pricing](https://mistral.ai/technology/#pricing)
- Rate Limits variieren je nach Plan
- Empfehlung: Caching für häufige Anfragen implementieren

## Troubleshooting

### KI-Features sind deaktiviert

**Problem**: API gibt 503 zurück mit "KI-Service nicht verfügbar"

**Lösung**:
1. Überprüfen Sie, ob `MISTRAL_API_KEY` in `.env` gesetzt ist
2. Starten Sie das Backend neu
3. Prüfen Sie Status mit `GET /api/ai/status`

### Falsche oder unpassende Vorschläge

**Problem**: KI gibt irrelevante Produktvorschläge

**Lösung**:
1. Aktivieren Sie `includeContext: true` für bessere Vorschläge
2. Passen Sie die System-Prompts in `mistral.service.ts` an
3. Erweitern Sie die Produktdatenbank für besseren Kontext

### Rate Limit Errors

**Problem**: API gibt 429 zurück

**Lösung**:
1. Implementieren Sie Client-seitiges Debouncing
2. Caching für häufige Anfragen
3. Upgrade Ihres Mistral AI Plans

## Sicherheit

- API-Keys niemals im Frontend Code speichern
- Nur authentifizierte Requests erlauben
- Rate Limiting auf Backend-Ebene empfohlen
- Audit-Logging für KI-Anfragen aktivieren

## Weiterführende Links

- [Mistral AI Dokumentation](https://docs.mistral.ai/)
- [Mistral AI Console](https://console.mistral.ai/)
- [GitHub Repository](https://github.com/mistralai/client-ts)
