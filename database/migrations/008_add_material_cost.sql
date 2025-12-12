-- Migration 008: Kosten-Feld für Materialien hinzufügen
-- Dieses Feld ist optional und dient zur Erfassung der Kosten pro Einheit (gekoppelt an GTIN/Artikelnummer)

-- Kosten-Spalte zur materials-Tabelle hinzufügen
ALTER TABLE materials 
ADD COLUMN cost DECIMAL(10,2) NULL COMMENT 'Kosten pro Einheit in EUR' AFTER article_number;

-- Index für Kosten-Auswertungen (optional, aber nützlich für Berichte)
CREATE INDEX idx_materials_cost ON materials(cost);

-- View aktualisieren um Kosten einzuschließen
DROP VIEW IF EXISTS v_materials_overview;

CREATE VIEW v_materials_overview AS
SELECT 
  m.id,
  m.name,
  m.description,
  m.size,
  m.unit,
  m.min_stock,
  m.current_stock,
  m.expiry_date,
  m.lot_number,
  m.article_number,
  m.cost,
  m.location_in_cabinet,
  m.shipping_container_code,
  m.notes,
  m.active,
  m.created_at,
  m.updated_at,
  m.unit_id,
  c.id AS category_id,
  c.name AS category_name,
  c.min_quantity AS category_min_quantity,
  co.id AS company_id,
  co.name AS company_name,
  cab.id AS cabinet_id,
  cab.name AS cabinet_name,
  cab.location AS cabinet_location,
  u.id AS department_id,
  u.name AS unit_name,
  CASE 
    WHEN m.current_stock <= 0 THEN 'OUT'
    WHEN m.current_stock <= COALESCE(c.min_quantity, m.min_stock, 0) THEN 'LOW'
    WHEN m.expiry_date IS NOT NULL AND m.expiry_date <= DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY) THEN 'EXPIRING'
    ELSE 'OK'
  END AS stock_status
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN units u ON m.unit_id = u.id;
