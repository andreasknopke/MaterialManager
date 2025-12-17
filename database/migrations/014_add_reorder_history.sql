-- Migration: Reorder History
-- Erstellt eine Tabelle für die Nachbestellungshistorie

CREATE TABLE IF NOT EXISTS reorder_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  gtin VARCHAR(14),
  product_name VARCHAR(255) NOT NULL,
  quantity_ordered INT NOT NULL DEFAULT 1,
  ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ordered_by INT,
  ordered_by_name VARCHAR(100),
  notes TEXT,
  status ENUM('ordered', 'received', 'cancelled') DEFAULT 'ordered',
  received_at TIMESTAMP NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (ordered_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_ordered_at (ordered_at),
  INDEX idx_product_id (product_id),
  INDEX idx_status (status)
);
