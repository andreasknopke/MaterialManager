-- Migration 006: Fix v_materials_overview to include unit_id for department filtering
-- Datum: 2025-12-11

-- View für Materialübersicht mit unit_id für Department-Filterung
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
    m.category_id,
    m.company_id,
    m.cabinet_id,
    m.unit_id,
    c.name AS category_name,
    co.name AS company_name,
    cab.name AS cabinet_name,
    cab.location AS cabinet_location,
    u.name AS unit_name,
    u.color AS unit_color,
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
LEFT JOIN units u ON m.unit_id = u.id;
