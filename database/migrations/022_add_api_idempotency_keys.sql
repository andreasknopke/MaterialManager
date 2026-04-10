-- Migration 022: Idempotenz-Schutz fuer API-POSTs
-- Verhindert doppelte Material-Anlagen beim Nachsenden oder bei Netzwerk-Timeouts

CREATE TABLE IF NOT EXISTS api_idempotency_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL DEFAULT 0,
    endpoint VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    response_status INT NOT NULL,
    response_body LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_api_idempotency (user_id, endpoint, idempotency_key)
);