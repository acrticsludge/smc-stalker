-- 005_colors.sql
-- Add embed color columns for dynmap-sourced colouring.

ALTER TABLE towns ADD COLUMN IF NOT EXISTS color INTEGER;
ALTER TABLE nations ADD COLUMN IF NOT EXISTS color INTEGER;
