-- Migration 012: Consignationsware-Feld hinzufügen
-- Markiert Materialien als Konsignationsware (rote Markierung in Listen)

-- Spalte zur materials-Tabelle hinzufügen
ALTER TABLE materials 
ADD COLUMN is_consignment BOOLEAN DEFAULT FALSE COMMENT 'Konsignationsware - wird rot markiert in Listen';

-- View aktualisieren um is_consignment einzuschließen
CREATE OR REPLACE VIEW v_materials_overview AS
SELECT 
    m.id,
    m.name,
    m.description,
    m.size,
    m.unit,
    m.min_stock AS material_min_stock,
    m.current_stock,
    m.expiry_date,
    m.lot_number,
    m.article_number,
    m.cost,
    m.location_in_cabinet,
    m.shipping_container_code,
    m.notes,
    m.active,
    m.is_consignment,
    m.created_at,
    m.updated_at,
    m.category_id,
    c.name AS category_name,
    c.min_quantity AS category_min_stock,
    CASE 
        WHEN m.min_stock > 0 THEN m.min_stock
        ELSE COALESCE(c.min_quantity, 0)
    END AS effective_min_stock,
    m.company_id,
    co.name AS company_name,
    m.cabinet_id,
    cab.name AS cabinet_name,
    cab.location AS cabinet_location,
    cab.unit_id AS cabinet_unit_id,
    m.compartment_id,
    comp.name AS compartment_name,
    m.unit_id,
    u.name AS unit_name,
    CASE
        WHEN m.current_stock <= 0 THEN 'OUT_OF_STOCK'
        WHEN m.current_stock <= (CASE WHEN m.min_stock > 0 THEN m.min_stock ELSE COALESCE(c.min_quantity, 0) END) THEN 'LOW'
        WHEN m.expiry_date IS NOT NULL AND m.expiry_date <= DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY) THEN 'EXPIRING'
        ELSE 'OK'
    END AS stock_status
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN compartments comp ON m.compartment_id = comp.id
LEFT JOIN units u ON m.unit_id = u.id;

-- Auch die v_low_stock_materials View aktualisieren
CREATE OR REPLACE VIEW v_low_stock_materials AS
SELECT 
    m.id,
    m.name,
    m.description,
    m.size,
    m.unit,
    m.min_stock AS material_min_stock,
    m.current_stock,
    m.expiry_date,
    m.lot_number,
    m.article_number,
    m.cost,
    m.location_in_cabinet,
    m.shipping_container_code,
    m.notes,
    m.active,
    m.is_consignment,
    m.created_at,
    m.updated_at,
    m.category_id,
    c.name AS category_name,
    c.min_quantity AS category_min_stock,
    CASE 
        WHEN m.min_stock > 0 THEN m.min_stock
        ELSE COALESCE(c.min_quantity, 0)
    END AS effective_min_stock,
    m.company_id,
    co.name AS company_name,
    m.cabinet_id,
    cab.name AS cabinet_name,
    cab.location AS cabinet_location,
    cab.unit_id AS cabinet_unit_id,
    m.compartment_id,
    comp.name AS compartment_name,
    m.unit_id,
    u.name AS unit_name,
    'LOW' AS stock_status
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN compartments comp ON m.compartment_id = comp.id
LEFT JOIN units u ON m.unit_id = u.id
WHERE m.active = TRUE 
  AND m.current_stock <= (CASE WHEN m.min_stock > 0 THEN m.min_stock ELSE COALESCE(c.min_quantity, 0) END)
  AND (CASE WHEN m.min_stock > 0 THEN m.min_stock ELSE COALESCE(c.min_quantity, 0) END) > 0;
