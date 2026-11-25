-- Index tuning based on measured query plans (135k streets, simulated 200k reports).

-- Unused: no query applies array operators to osm_node_ids (the resolver selects
-- streets by bounding box). Dropping it frees ~49 MB and speeds OSM imports.
DROP INDEX IF EXISTS public.idx_streets_osm_node_ids;

-- Expired reports accumulate forever while only closed/open ones are read
-- (home map, expiry job). A partial index stays small and also serves the
-- home category filter; it replaces the full status index.
DROP INDEX IF EXISTS public.idx_reports_status;
CREATE INDEX idx_reports_active_category
    ON public.reports (category)
    WHERE status IN ('closed', 'open');

-- The geography cast hides the GIST index on coordinates, so every lookup
-- scanned all streets. The && box (~11 m, wider than the 5 m limit) lets the
-- index prefilter before the exact geography check.
CREATE OR REPLACE FUNCTION public.get_nearest_street_name(
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION
)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
    SELECT COALESCE(NULLIF(s.name, ''), 'Jalan tanpa nama')
    FROM public.streets AS s
    WHERE p_lat BETWEEN -90 AND 90
      AND p_lng BETWEEN -180 AND 180
      AND s.coordinates && ST_Expand(ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), 0.0001)
      AND ST_DWithin(
          s.coordinates::GEOGRAPHY,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY,
          5
      )
    ORDER BY s.coordinates::GEOGRAPHY
        <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY
    LIMIT 1;
$$;
