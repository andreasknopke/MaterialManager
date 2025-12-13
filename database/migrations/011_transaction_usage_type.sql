-- Migration 011: Nutzungsart für Transaktionen (patient_use, destock, correction)
-- Datum: 2024-12-13

-- Neues Feld für die Nutzungsart hinzufügen
ALTER TABLE material_transactions 
ADD COLUMN usage_type ENUM('patient_use', 'destock', 'correction', 'stock_in', 'initial') DEFAULT 'destock' 
AFTER transaction_type;

-- Bestehende Daten aktualisieren: 'in' Transaktionen auf 'stock_in' setzen
UPDATE material_transactions SET usage_type = 'stock_in' WHERE transaction_type = 'in';

-- Index für schnellere Abfragen
CREATE INDEX idx_material_transactions_usage_type ON material_transactions(usage_type);
