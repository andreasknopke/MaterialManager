-- Migration 010: Material-Mindestbestand parallel zu Kategorie-Mindestbestand
-- Datum: 2024-12-13

-- Das min_stock Feld existiert bereits in materials
-- Wir müssen nur die View aktualisieren, um beide Mindestbestände zu berücksichtigen

-- Alte View droppen und neu erstellen
DROP VIEW IF EXISTS v_materials_overview;

CREATE VIEW v_materials_overview AS
SELECT 
    m.id,
    m.category_id,
    m.company_id,
    m.cabinet_id,
    m.compartment_id,
    m.unit_id,
    m.name,
    m.description,
    m.size,
    m.unit,
    m.current_stock,
    m.min_stock AS material_min_stock,
    m.cost,
    m.expiry_date,
    m.lot_number,
    m.article_number,
    m.location_in_cabinet,
    m.active,
    m.created_at,
    m.updated_at,
    c.name AS category_name,
    c.min_quantity AS category_min_stock,
    -- Effektiver Mindestbestand: Material-Mindestbestand hat Priorität wenn > 0, sonst Kategorie
    CASE 
        WHEN m.min_stock > 0 THEN m.min_stock
        WHEN c.min_quantity IS NOT NULL AND c.min_quantity > 0 THEN c.min_quantity
        ELSE 0
    END AS effective_min_stock,
    co.name AS company_name,
    cab.name AS cabinet_name,
    cab.location AS cabinet_location,
    cab.unit_id AS cabinet_unit_id,
    comp.name AS compartment_name,
    u.name AS unit_name,
    CASE 
        WHEN m.min_stock > 0 AND m.current_stock <= m.min_stock THEN 'LOW'
        WHEN m.min_stock = 0 AND c.min_quantity IS NOT NULL AND c.min_quantity > 0 AND m.current_stock <= c.min_quantity THEN 'LOW'
        WHEN m.expiry_date IS NOT NULL AND m.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'EXPIRING'
        ELSE 'OK'
    END AS stock_status
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN compartments comp ON m.compartment_id = comp.id
LEFT JOIN units u ON m.unit_id = u.id;

-- View für Materialien mit niedrigem Bestand aktualisieren
DROP VIEW IF EXISTS v_low_stock_materials;

CREATE VIEW v_low_stock_materials AS
SELECT 
    m.*,
    c.name AS category_name,
    c.min_quantity AS category_min_stock,
    co.name AS company_name,
    cab.name AS cabinet_name,
    -- Effektiver Mindestbestand
    CASE 
        WHEN m.min_stock > 0 THEN m.min_stock
        WHEN c.min_quantity IS NOT NULL AND c.min_quantity > 0 THEN c.min_quantity
        ELSE 0
    END AS effective_min_stock
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
WHERE 
    (m.min_stock > 0 AND m.current_stock <= m.min_stock)
    OR 
    (m.min_stock = 0 AND c.min_quantity IS NOT NULL AND c.min_quantity > 0 AND m.current_stock <= c.min_quantity)
    AND m.active = TRUE
ORDER BY (m.current_stock - CASE 
        WHEN m.min_stock > 0 THEN m.min_stock
        WHEN c.min_quantity IS NOT NULL AND c.min_quantity > 0 THEN c.min_quantity
        ELSE 0
    END) ASC;
