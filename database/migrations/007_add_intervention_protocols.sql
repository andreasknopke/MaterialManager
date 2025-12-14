-- Migration 007: Interventionsprotokolle
-- Speichert abgeschlossene Interventionsprotokolle mit Patientenzuordnung

-- Haupttabelle für Interventionsprotokolle
CREATE TABLE IF NOT EXISTS intervention_protocols (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(100) NOT NULL COMMENT 'Barcode des Patienten',
    patient_name VARCHAR(255) NULL COMMENT 'Optionaler Patientenname',
    started_at DATETIME NOT NULL COMMENT 'Wann wurde die Intervention begonnen',
    ended_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Wann wurde die Intervention beendet',
    total_items INT NOT NULL DEFAULT 0 COMMENT 'Anzahl der Entnahmen',
    notes TEXT NULL COMMENT 'Optionale Notizen',
    created_by INT NULL COMMENT 'User ID des Erstellers',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_patient_id (patient_id),
    INDEX idx_started_at (started_at),
    INDEX idx_ended_at (ended_at),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabelle für die einzelnen Protokoll-Einträge
CREATE TABLE IF NOT EXISTS intervention_protocol_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    protocol_id INT NOT NULL COMMENT 'Referenz zum Protokoll',
    material_name VARCHAR(255) NOT NULL COMMENT 'Name des Materials',
    article_number VARCHAR(100) NULL COMMENT 'Artikelnummer/GTIN',
    lot_number VARCHAR(100) NULL COMMENT 'Chargennummer',
    gtin VARCHAR(100) NULL COMMENT 'GTIN falls vorhanden',
    quantity INT NOT NULL DEFAULT 1 COMMENT 'Entnommene Menge',
    taken_at DATETIME NOT NULL COMMENT 'Zeitpunkt der Entnahme',
    
    INDEX idx_protocol_id (protocol_id),
    INDEX idx_lot_number (lot_number),
    FOREIGN KEY (protocol_id) REFERENCES intervention_protocols(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
