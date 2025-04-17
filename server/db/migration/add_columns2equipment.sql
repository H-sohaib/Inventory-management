-- This SQL script adds an image column to the Equipement table
use gestion_stock;

ALTER TABLE Equipement
ADD COLUMN image VARCHAR(255) DEFAULT 'public/images/default-equipment.png',
ADD COLUMN datasheet_url VARCHAR(255) DEFAULT NULL;