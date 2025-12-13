-- Migration 013: Add device property fields for materials
-- Adds optional fields: shape, shaft_length, device_length, device_diameter, french_size, guidewire_acceptance

-- Add new columns to materials table
ALTER TABLE materials
ADD COLUMN shape_id INT NULL,
ADD COLUMN shaft_length VARCHAR(50) NULL,
ADD COLUMN device_length VARCHAR(50) NULL,
ADD COLUMN device_diameter VARCHAR(50) NULL,
ADD COLUMN french_size VARCHAR(20) NULL,
ADD COLUMN guidewire_acceptance ENUM('0.014in', '0.018in', '0.032in', '0.038in') NULL;

-- Create shapes table for configurable shape options
CREATE TABLE IF NOT EXISTS shapes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default shape options
INSERT INTO shapes (name, sort_order) VALUES
('Straight', 1),
('Pigtail', 2),
('Cobra', 3),
('Simm 1', 4),
('Simm 2', 5),
('MPA', 6),
('Vert', 7),
('Bern', 8),
('Shepherd Hook', 9),
('MG1', 10),
('MG2', 11),
('C1', 12),
('C2', 13);

-- Add foreign key constraint
ALTER TABLE materials
ADD CONSTRAINT fk_materials_shape
FOREIGN KEY (shape_id) REFERENCES shapes(id) ON DELETE SET NULL;

-- Update the materials overview view to include new fields
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
    m.is_consignment,
    m.shape_id,
    s.name as shape_name,
    m.shaft_length,
    m.device_length,
    m.device_diameter,
    m.french_size,
    m.guidewire_acceptance,
    m.category_id,
    c.name as category_name,
    m.company_id,
    co.name as company_name,
    m.cabinet_id,
    cab.name as cabinet_name,
    cab.location as cabinet_location,
    m.compartment_id,
    comp.name as compartment_name,
    m.unit_id,
    u.name as unit_name,
    m.created_at,
    m.updated_at,
    CASE 
        WHEN m.current_stock <= m.min_stock THEN 'LOW'
        WHEN m.expiry_date IS NOT NULL AND m.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'EXPIRING'
        ELSE 'OK'
    END as stock_status
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN companies co ON m.company_id = co.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN compartments comp ON m.compartment_id = comp.id
LEFT JOIN units u ON m.unit_id = u.id
LEFT JOIN shapes s ON m.shape_id = s.id;
