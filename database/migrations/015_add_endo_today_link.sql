-- Migration: Add Endovascular Today Link to Categories
-- Adds a column for storing a link to Endovascular Today website

ALTER TABLE categories ADD COLUMN endo_today_link VARCHAR(500) NULL AFTER zusatzentgelt;
