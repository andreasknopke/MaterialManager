-- Migration: Verfallsdatum zu Interventionsprotokoll-Items hinzufügen
-- Datum: 2024-12-16

ALTER TABLE intervention_protocol_items 
ADD COLUMN expiry_date DATE NULL AFTER lot_number;

-- Index für schnelle Suche nach Verfallsdatum
CREATE INDEX idx_intervention_items_expiry ON intervention_protocol_items(expiry_date);
