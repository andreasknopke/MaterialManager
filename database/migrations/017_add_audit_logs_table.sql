-- Migration: Audit-Logs Tabelle erstellen
-- Diese Tabelle wird für das zentrale Audit-Log-System benötigt

USE material_manager;

-- Zentrale Audit-Logs Tabelle
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    username VARCHAR(100),
    action VARCHAR(50) NOT NULL COMMENT 'CREATE, UPDATE, DELETE, LOGIN, LOGOUT, VIEW, EXPORT, IMPORT, STOCK_IN, STOCK_OUT, TRANSFER',
    entity_type VARCHAR(50) NOT NULL COMMENT 'MATERIAL, CABINET, CATEGORY, COMPANY, USER, INTERVENTION, UNIT',
    entity_id INT,
    entity_name VARCHAR(255),
    old_values JSON COMMENT 'Werte vor der Änderung',
    new_values JSON COMMENT 'Werte nach der Änderung',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_entity_type (entity_type),
    INDEX idx_entity_id (entity_id),
    INDEX idx_created_at (created_at),
    INDEX idx_username (username),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Zentrale Audit-Logs für alle Systemaktionen';

-- Migriere bestehende Daten aus user_audit_log falls vorhanden
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, entity_name, new_values, ip_address, created_at)
SELECT 
    user_id,
    action,
    'USER',
    user_id,
    NULL,
    details,
    ip_address,
    created_at
FROM user_audit_log
WHERE NOT EXISTS (SELECT 1 FROM audit_logs LIMIT 1);
