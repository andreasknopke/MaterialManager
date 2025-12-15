-- Migration: Guidewire Acceptance 0.035in hinzufügen
-- Datum: 2024-12-15

-- Erweitert das ENUM um den neuen Wert 0.035in (sortiert einfügen)
ALTER TABLE materials MODIFY COLUMN guidewire_acceptance 
  ENUM('0.014in','0.018in','0.032in','0.035in','0.038in') NULL;
