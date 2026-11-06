-- UrbanFlow migration 001
-- Correct OSM record semantics and add integrity constraints.
--
-- OSM construction tags do not confirm an active closure or a start/end date.
-- Older UrbanFlow releases stored these records as active with "exact" geometry.
-- This migration:
--   1. uses the OSM last-edit timestamp as the recorded date,
--   2. marks OSM records with status = 'unknown',
--   3. marks OSM coordinates as a road-segment centre ('segment'),
--   4. adds category, severity, status and precision check constraints.
--
-- Safe to run more than once.

BEGIN;

-- Drop the old constraint before updating rows to the new status value.
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS ck_incidents_status;

UPDATE incidents
SET location_precision = 'segment'
WHERE location_precision = 'exact';

UPDATE incidents AS i
SET start_time = COALESCE(
        NULLIF(i.raw_payload ->> 'osm_timestamp', '')::timestamptz,
        i.start_time
    ),
    published_at = COALESCE(
        NULLIF(i.raw_payload ->> 'osm_timestamp', '')::timestamptz,
        i.published_at
    ),
    last_updated_at = COALESCE(
        NULLIF(i.raw_payload ->> 'osm_timestamp', '')::timestamptz,
        i.last_updated_at
    ),
    status = 'unknown'
WHERE i.source_id IN (SELECT id FROM data_sources WHERE slug = 'osm-overpass');

ALTER TABLE incidents ADD CONSTRAINT ck_incidents_status
    CHECK (status IN ('active', 'upcoming', 'resolved', 'unknown'));

ALTER TABLE incidents DROP CONSTRAINT IF EXISTS ck_incidents_category;
ALTER TABLE incidents ADD CONSTRAINT ck_incidents_category
    CHECK (category IN (
        'Accident', 'Road Closure', 'Construction', 'Traffic Diversion',
        'Public Event', 'Parking Restriction', 'Other'
    ));

ALTER TABLE incidents DROP CONSTRAINT IF EXISTS ck_incidents_severity;
ALTER TABLE incidents ADD CONSTRAINT ck_incidents_severity
    CHECK (severity IN ('low', 'medium', 'high'));

ALTER TABLE incidents DROP CONSTRAINT IF EXISTS ck_incidents_location_precision;
ALTER TABLE incidents ADD CONSTRAINT ck_incidents_location_precision
    CHECK (location_precision IN ('locality', 'segment', 'unknown'));

COMMIT;
