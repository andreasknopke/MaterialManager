-- Migration 020: Add endo_today_link to v_materials_overview
-- Fügt das endo_today_link Feld aus der Kategorie zur Material-Übersichtsview hinzu

DROP VIEW IF EXISTS v_materials_overview;

CREATE VIEW v_materials_overview AS
SELECT 
    m.id,
    m.name,
    m.description,
    m.size,
    m.unit,
    m.current_stock,
    m.min_stock,
    m.expiry_date,
    m.lot_number,
    m.article_number,
    m.location_in_cabinet,
    m.active,
    m.is_consignment,
    m.cost,
    m.shape_id,
    m.shaft_length,
    m.device_length,
    m.device_diameter,
    m.french_size,
    m.guidewire_acceptance,
    m.notes,
    m.compartment_id,
    m.product_id,
    m.category_id,
    m.company_id,
    m.cabinet_id,
    m.unit_id,
    c.name AS category_name,
    c.min_quantity AS category_min_quantity,
    c.endo_today_link,
    co.name AS company_name,
    cab.name AS cabinet_name,
    cab.unit_id AS cabinet_department_id,
    cab.location AS cabinet_location,
    comp.name AS compartment_name,
    comp.position AS compartment_position,
    p.name AS product_name,
    p.gtin AS product_gtin,
    s.name AS shape_name,
    CASE 
        WHEN m.current_stock <= m.min_stock THEN 'LOW'
        WHEN m.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'EXPIRING'
        ELSE 'OK'
    END AS stock_status,
    m.created_at,
    m.updated_at
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN compartments comp ON m.compartment_id = comp.id
LEFT JOIN products p ON m.product_id = p.id
LEFT JOIN shapes s ON m.shape_id = s.id;
