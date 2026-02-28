-- Add short_name column for compact SMS display
ALTER TABLE shops ADD COLUMN short_name varchar(12);

-- Backfill from existing name (truncated to 12 chars)
UPDATE shops SET short_name = LEFT(name, 12);

-- Now enforce NOT NULL
ALTER TABLE shops ALTER COLUMN short_name SET NOT NULL;
