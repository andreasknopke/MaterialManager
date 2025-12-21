-- Migration 019: Verknüpfung zwischen Transaktionen und Interventionsprotokoll-Items
-- Ermöglicht nachträgliche Patientenzuordnung für Materialausgänge
-- Datum: 2024-12-21

-- 1. Spalte für Protokoll-Item-Verknüpfung in material_transactions hinzufügen
ALTER TABLE material_transactions 
ADD COLUMN protocol_item_id INT NULL COMMENT 'Verknüpfung zum Interventionsprotokoll-Item falls Patientenzuordnung' 
AFTER unit_id;

-- 2. Spalte für Transaktions-Verknüpfung in intervention_protocol_items hinzufügen
ALTER TABLE intervention_protocol_items 
ADD COLUMN transaction_id INT NULL COMMENT 'Verknüpfung zur Original-Transaktion für nachträgliche Zuordnung' 
AFTER protocol_id;

-- 3. Foreign Keys erstellen
ALTER TABLE material_transactions 
ADD CONSTRAINT fk_transaction_protocol_item 
FOREIGN KEY (protocol_item_id) REFERENCES intervention_protocol_items(id) ON DELETE SET NULL;

ALTER TABLE intervention_protocol_items 
ADD CONSTRAINT fk_protocol_item_transaction 
FOREIGN KEY (transaction_id) REFERENCES material_transactions(id) ON DELETE SET NULL;

-- 4. Indizes für schnelle Suche nach nicht zugeordneten Ausgängen
CREATE INDEX idx_transactions_protocol_item ON material_transactions(protocol_item_id);
CREATE INDEX idx_protocol_items_transaction ON intervention_protocol_items(transaction_id);

-- 5. View für nicht zugeordnete Ausgänge (Stock-Outs ohne Patientenzuordnung)
CREATE OR REPLACE VIEW v_unassigned_stockouts AS
SELECT 
  t.id AS transaction_id,
  t.material_id,
  m.name AS material_name,
  m.article_number,
  t.lot_number AS transaction_lot,
  m.lot_number AS material_lot,
  m.expiry_date,
  t.quantity,
  t.transaction_date,
  t.usage_type,
  t.notes,
  t.reference_number,
  COALESCE(u.full_name, u.username, t.user_name) AS performed_by,
  m.unit_id,
  un.name AS unit_name,
  cat.name AS category_name,
  m.is_consignment
FROM material_transactions t
JOIN materials m ON t.material_id = m.id
LEFT JOIN users u ON t.user_id = u.id
LEFT JOIN units un ON m.unit_id = un.id
LEFT JOIN categories cat ON m.category_id = cat.id
WHERE t.transaction_type = 'out'
  AND t.protocol_item_id IS NULL
ORDER BY t.transaction_date DESC;

-- 6. Spalte für LOT-Nummer in material_transactions hinzufügen (für genauere Suche)
ALTER TABLE material_transactions 
ADD COLUMN lot_number VARCHAR(100) NULL COMMENT 'LOT-Nummer zum Zeitpunkt der Transaktion' 
AFTER protocol_item_id;

-- Index für LOT-Nummer-Suche
CREATE INDEX idx_transactions_lot ON material_transactions(lot_number);
