-- Add collection_type enum and type column to shops table
CREATE TYPE collection_type AS ENUM (
  'workshop',
  'kitchen',
  'craft_room',
  'library',
  'garage',
  'closet',
  'party_supplies',
  'general'
);

ALTER TABLE shops ADD COLUMN type collection_type NOT NULL DEFAULT 'general';
