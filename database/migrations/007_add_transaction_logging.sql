-- Migration 007: Erweitertes Transaction-Logging für Statistiken
-- Datum: 12. Dezember 2025

-- 1. Erweitere material_transactions Tabelle mit user_id und department tracking
ALTER TABLE material_transactions 
  ADD COLUMN IF NOT EXISTS user_id INT AFTER user_name,
  ADD COLUMN IF NOT EXISTS unit_id INT COMMENT 'Department zum Zeitpunkt der Transaktion',
  ADD INDEX IF NOT EXISTS idx_user_id (user_id),
  ADD INDEX IF NOT EXISTS idx_unit_id (unit_id),
  ADD INDEX IF NOT EXISTS idx_transaction_date_type (transaction_date, transaction_type);

-- 2. Foreign Key für user_id (optional, da historische Daten user_name haben könnten)
-- ALTER TABLE material_transactions 
--   ADD CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3. View für Transaktionen mit allen Details
CREATE OR REPLACE VIEW v_material_transactions AS
SELECT 
  t.id,
  t.material_id,
  m.name AS material_name,
  m.article_number,
  t.transaction_type,
  t.quantity,
  t.previous_stock,
  t.new_stock,
  t.reference_number,
  t.notes,
  t.user_id,
  COALESCE(u.full_name, u.username, t.user_name) AS performed_by,
  t.transaction_date,
  m.unit_id,
  un.name AS unit_name,
  m.cabinet_id,
  cab.name AS cabinet_name,
  m.category_id,
  cat.name AS category_name
FROM material_transactions t
JOIN materials m ON t.material_id = m.id
LEFT JOIN users u ON t.user_id = u.id
LEFT JOIN units un ON m.unit_id = un.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN categories cat ON m.category_id = cat.id;

-- 4. View für tägliche Statistiken pro Department
CREATE OR REPLACE VIEW v_daily_transaction_stats AS
SELECT 
  DATE(t.transaction_date) AS transaction_date,
  m.unit_id,
  un.name AS unit_name,
  t.transaction_type,
  COUNT(*) AS transaction_count,
  SUM(t.quantity) AS total_quantity
FROM material_transactions t
JOIN materials m ON t.material_id = m.id
LEFT JOIN units un ON m.unit_id = un.id
GROUP BY DATE(t.transaction_date), m.unit_id, un.name, t.transaction_type;

-- 5. View für Material-Bewegungsstatistik (Höchst-/Tiefststände)
CREATE OR REPLACE VIEW v_material_stock_stats AS
SELECT 
  m.id AS material_id,
  m.name AS material_name,
  m.article_number,
  m.current_stock,
  m.min_stock,
  m.unit_id,
  un.name AS unit_name,
  cab.name AS cabinet_name,
  cat.name AS category_name,
  -- Statistiken aus Transaktionen
  (SELECT MAX(new_stock) FROM material_transactions WHERE material_id = m.id) AS max_stock_ever,
  (SELECT MIN(new_stock) FROM material_transactions WHERE material_id = m.id AND new_stock > 0) AS min_stock_ever,
  (SELECT SUM(quantity) FROM material_transactions WHERE material_id = m.id AND transaction_type = 'in') AS total_in,
  (SELECT SUM(quantity) FROM material_transactions WHERE material_id = m.id AND transaction_type = 'out') AS total_out,
  (SELECT COUNT(*) FROM material_transactions WHERE material_id = m.id) AS transaction_count,
  (SELECT transaction_date FROM material_transactions WHERE material_id = m.id ORDER BY transaction_date DESC LIMIT 1) AS last_transaction_date
FROM materials m
LEFT JOIN units un ON m.unit_id = un.id
LEFT JOIN cabinets cab ON m.cabinet_id = cab.id
LEFT JOIN categories cat ON m.category_id = cat.id
WHERE m.active = TRUE;

-- 6. View für monatliche Übersicht
CREATE OR REPLACE VIEW v_monthly_transaction_summary AS
SELECT 
  YEAR(t.transaction_date) AS year,
  MONTH(t.transaction_date) AS month,
  m.unit_id,
  un.name AS unit_name,
  SUM(CASE WHEN t.transaction_type = 'in' THEN t.quantity ELSE 0 END) AS total_in,
  SUM(CASE WHEN t.transaction_type = 'out' THEN t.quantity ELSE 0 END) AS total_out,
  COUNT(CASE WHEN t.transaction_type = 'in' THEN 1 END) AS in_count,
  COUNT(CASE WHEN t.transaction_type = 'out' THEN 1 END) AS out_count,
  COUNT(DISTINCT t.material_id) AS materials_affected,
  COUNT(DISTINCT t.user_id) AS active_users
FROM material_transactions t
JOIN materials m ON t.material_id = m.id
LEFT JOIN units un ON m.unit_id = un.id
GROUP BY YEAR(t.transaction_date), MONTH(t.transaction_date), m.unit_id, un.name;

-- 7. Update bestehende Transaktionen mit unit_id (falls vorhanden)
UPDATE material_transactions t
JOIN materials m ON t.material_id = m.id
SET t.unit_id = m.unit_id
WHERE t.unit_id IS NULL;

-- Fertig!
