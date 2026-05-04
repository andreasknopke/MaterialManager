-- Migration 023: Alternative/verknüpfte GTINs für Packung- und Einzelprodukt-Barcodes
-- Datum: 2026-05-04

CREATE TABLE IF NOT EXISTS product_gtin_aliases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    alias_gtin VARCHAR(100) NOT NULL,
    relation_type ENUM('package_unit', 'equivalent', 'legacy', 'other') DEFAULT 'package_unit',
    package_quantity INT NULL COMMENT 'Optionale Anzahl Einzelstücke pro Packung',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_gtin_aliases_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_product_alias_gtin (product_id, alias_gtin),
    UNIQUE KEY uniq_alias_gtin (alias_gtin),
    INDEX idx_product_gtin_aliases_product (product_id),
    INDEX idx_product_gtin_aliases_alias (alias_gtin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Migration abgeschlossen: Alternative GTINs für Produkte hinzugefügt' AS status;
