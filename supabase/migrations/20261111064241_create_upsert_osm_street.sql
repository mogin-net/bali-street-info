
CREATE OR REPLACE FUNCTION public.upsert_osm_street(
    p_osm_way_id BIGINT,
    p_name TEXT,
    p_coordinates JSONB
)
RETURNS public.streets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    saved_street public.streets;
BEGIN
    IF p_osm_way_id IS NULL OR p_osm_way_id <= 0 THEN
        RAISE EXCEPTION 'Invalid OSM Way ID';
    END IF;

    IF p_coordinates IS NULL
       OR p_coordinates->>'type' <> 'LineString'
       OR jsonb_typeof(p_coordinates->'coordinates') <> 'array'
       OR jsonb_array_length(p_coordinates->'coordinates') < 2
    THEN
        RAISE EXCEPTION 'Invalid road geometry';
    END IF;

    INSERT INTO public.streets (
        osm_way_id,
        name,
        coordinates
    )
    VALUES (
        p_osm_way_id,
        p_name,
        extensions.ST_SetSRID(
            extensions.ST_GeomFromGeoJSON(p_coordinates::text),
            4326
        )
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

-- Hanya backend dengan service role yang boleh memanggil fungsi ini.
REVOKE ALL ON FUNCTION public.upsert_osm_street(
    BIGINT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_osm_street(
    BIGINT, TEXT, JSONB
) TO service_role;
