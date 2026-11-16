CREATE OR REPLACE FUNCTION public.search_home_streets(p_query TEXT)
RETURNS TABLE (
    place_id UUID,
    display_name TEXT,
    lat TEXT,
    lon TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT
        s.uuid,
        s.name::TEXT,
        ST_Y(ST_LineInterpolatePoint(s.coordinates, 0.5))::TEXT,
        ST_X(ST_LineInterpolatePoint(s.coordinates, 0.5))::TEXT
    FROM public.streets AS s
    WHERE NULLIF(BTRIM(p_query), '') IS NOT NULL
      AND s.name IS NOT NULL
      AND s.coordinates && ST_MakeEnvelope(115.238, -8.721, 115.283, -8.668, 4326)
      AND s.name ILIKE '%' || REPLACE(REPLACE(REPLACE(BTRIM(p_query), '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%' ESCAPE '\\'
    ORDER BY s.name
    LIMIT 8;
$$;

REVOKE ALL ON FUNCTION public.search_home_streets(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_home_streets(TEXT) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
