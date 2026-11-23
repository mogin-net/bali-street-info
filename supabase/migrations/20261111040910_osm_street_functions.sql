-- Bulk import used by the OSM import Edge Function.
CREATE OR REPLACE FUNCTION public.import_osm_streets(p_streets JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    IF jsonb_typeof(p_streets) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Street data must be a JSON array';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_streets) AS item
        WHERE COALESCE(item->>'osm_way_id' ~ '^[1-9][0-9]*$', FALSE) = FALSE
           OR item->'geometry'->>'type' IS DISTINCT FROM 'LineString'
           OR CASE
                WHEN jsonb_typeof(item->'geometry'->'coordinates') = 'array'
                    THEN jsonb_array_length(
                        item->'geometry'->'coordinates'
                    ) < 2
                ELSE TRUE
              END
    ) THEN
        RAISE EXCEPTION 'Invalid OSM Way ID or LineString geometry';
    END IF;

    INSERT INTO public.streets (osm_way_id, name, coordinates)
    SELECT
        (item->>'osm_way_id')::BIGINT,
        NULLIF(item->>'name', ''),
        ST_SetSRID(ST_GeomFromGeoJSON((item->'geometry')::TEXT), 4326)
    FROM jsonb_array_elements(p_streets) AS item
    ON CONFLICT (osm_way_id)
    DO UPDATE SET
        name = COALESCE(EXCLUDED.name, public.streets.name),
        coordinates = EXCLUDED.coordinates,
        dt_updated = NOW();

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.import_osm_streets(JSONB)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_osm_streets(JSONB)
TO service_role;

-- Single OSM Way upsert for backend callers that submit one feature at a time.
CREATE OR REPLACE FUNCTION public.upsert_osm_street(
    p_osm_way_id BIGINT,
    p_name TEXT,
    p_coordinates JSONB
)
RETURNS public.streets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
    saved_street public.streets;
BEGIN
    IF p_osm_way_id IS NULL OR p_osm_way_id <= 0 THEN
        RAISE EXCEPTION 'Invalid OSM Way ID';
    END IF;

    IF p_coordinates IS NULL
       OR p_coordinates->>'type' IS DISTINCT FROM 'LineString'
       OR jsonb_typeof(p_coordinates->'coordinates') IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_coordinates->'coordinates') < 2
    THEN
        RAISE EXCEPTION 'Invalid road geometry';
    END IF;

    INSERT INTO public.streets (osm_way_id, name, coordinates)
    VALUES (
        p_osm_way_id,
        NULLIF(p_name, ''),
        ST_SetSRID(ST_GeomFromGeoJSON(p_coordinates::TEXT), 4326)
    )
    ON CONFLICT (osm_way_id)
    DO UPDATE SET
        name = COALESCE(EXCLUDED.name, public.streets.name),
        coordinates = EXCLUDED.coordinates,
        dt_updated = NOW()
    RETURNING * INTO saved_street;

    RETURN saved_street;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_osm_street(BIGINT, TEXT, JSONB)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_osm_street(BIGINT, TEXT, JSONB)
TO service_role;
