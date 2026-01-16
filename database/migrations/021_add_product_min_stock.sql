-- Migration: min_stock auf Produkt-Ebene verschieben
-- Da identische Materialien (gleiche GTIN) denselben min_stock haben sollten,
-- wird dieser Wert jetzt in der products-Tabelle gespeichert.

-- Schritt 1: min_stock Spalte zur products-Tabelle hinzufügen
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS min_stock INT DEFAULT 0 COMMENT 'Mindestbestand für dieses Produkt';

-- Schritt 2: Bestehende min_stock Werte aus materials übernehmen
-- Nimmt den höchsten min_stock Wert pro GTIN (konservative Wahl)
UPDATE products p
SET p.min_stock = (
    SELECT MAX(m.min_stock)
    FROM materials m
    WHERE m.product_id = p.id
      AND m.min_stock > 0
)
WHERE EXISTS (
    SELECT 1 FROM materials m 
    WHERE m.product_id = p.id 
      AND m.min_stock > 0
);

-- Schritt 3: Index für schnelle Low-Stock-Abfragen
CREATE INDEX IF NOT EXISTS idx_products_min_stock ON products(min_stock);

-- Hinweis: Die min_stock Spalte in materials bleibt vorerst bestehen
-- für Abwärtskompatibilität, sollte aber nicht mehr verwendet werden.
-- In Zukunft könnte sie entfernt werden.
