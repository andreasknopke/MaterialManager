-- Migration: User Management System mit E-Mail-Verifizierung
-- Erweitert die users-Tabelle und fügt Authentifizierung hinzu

USE material_manager;

-- Erweiterte Users-Tabelle
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150),
    role ENUM('admin', 'user', 'viewer') DEFAULT 'user',
    is_root BOOLEAN DEFAULT FALSE COMMENT 'Root-User kann nicht gelöscht werden',
    active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP NULL,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP NULL,
    must_change_password BOOLEAN DEFAULT FALSE COMMENT 'Erzwingt Passwortänderung bei nächstem Login',
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_email_verification_token (email_verification_token),
    INDEX idx_password_reset_token (password_reset_token)
) ENGINE=InnoDB COMMENT='Benutzer mit Authentifizierung und E-Mail-Verifizierung';

-- Login-Versuch-Tracking (Rate Limiting)
CREATE TABLE IF NOT EXISTS login_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    ip_address VARCHAR(45),
    success BOOLEAN DEFAULT FALSE,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_ip (ip_address),
    INDEX idx_attempted_at (attempted_at)
) ENGINE=InnoDB COMMENT='Login-Versuche für Rate Limiting';

-- Session-Tabelle für JWT-Token-Management
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_token_hash (token_hash),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB COMMENT='Aktive Benutzer-Sessions';

-- Root-User erstellen mit Passwort "root" (bcrypt hash)
-- Passwort muss beim ersten Login geändert werden
INSERT INTO users (
    username, 
    email, 
    password_hash, 
    full_name, 
    role, 
    is_root, 
    active, 
    email_verified,
    must_change_password
) VALUES (
    'root',
    'root@materialmanager.local',
    '$2b$10$rKvVfVQJJqKGKx6yZ1XJXe5Y5qYxZJxGzWqZJxGzWqZJxGzWqZJxG', -- Passwort: "root"
    'Root Administrator',
    'admin',
    TRUE,
    TRUE,
    TRUE,
    TRUE
) ON DUPLICATE KEY UPDATE id=id;

-- Audit-Log für wichtige Benutzeraktionen
CREATE TABLE IF NOT EXISTS user_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL COMMENT 'login, logout, password_change, role_change, etc.',
    details JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB COMMENT='Audit-Log für Benutzeraktionen';

-- View für Benutzerübersicht (ohne sensible Daten)
CREATE OR REPLACE VIEW v_users_overview AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.full_name,
    u.role,
    u.is_root,
    u.active,
    u.email_verified,
    u.must_change_password,
    u.last_login,
    u.created_at,
    COUNT(DISTINCT s.id) as active_sessions
FROM users u
LEFT JOIN user_sessions s ON u.id = s.user_id AND s.expires_at > NOW()
GROUP BY u.id, u.username, u.email, u.full_name, u.role, u.is_root, 
         u.active, u.email_verified, u.must_change_password, u.last_login, u.created_at;

SELECT '✅ User Management System Migration completed!' AS status;
