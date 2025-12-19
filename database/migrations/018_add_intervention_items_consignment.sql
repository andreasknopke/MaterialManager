-- Migration 018: Konsignationsfeld zu Interventionsprotokoll-Items hinzufügen
-- Datum: 2024-12-19
-- Behebt Datenbankfehler beim Speichern von Interventionsprotokollen

-- Spalte is_consignment zur intervention_protocol_items hinzufügen
ALTER TABLE intervention_protocol_items 
ADD COLUMN IF NOT EXISTS is_consignment BOOLEAN DEFAULT FALSE AFTER quantity;

-- Index für schnelle Filterung nach Konsignationsware
CREATE INDEX IF NOT EXISTS idx_intervention_items_consignment ON intervention_protocol_items(is_consignment);
