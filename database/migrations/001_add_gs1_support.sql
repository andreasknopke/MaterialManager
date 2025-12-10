-- Migration: GS1 Barcode Support hinzufügen
-- Datum: 2025-12-10

USE material_manager;

-- Füge shipping_container_code Feld zur materials Tabelle hinzu
ALTER TABLE materials 
ADD COLUMN shipping_container_code VARCHAR(200) AFTER location_in_cabinet,
ADD INDEX idx_shipping_container (shipping_container_code);

-- Erweitere barcode_type ENUM um GS1-128
ALTER TABLE barcodes 
MODIFY COLUMN barcode_type ENUM('EAN13', 'EAN8', 'CODE128', 'GS1-128', 'QR', 'DATAMATRIX') DEFAULT 'CODE128';

-- Migration erfolgreich
SELECT 'Migration abgeschlossen: GS1 Barcode Support hinzugefügt' AS status;
