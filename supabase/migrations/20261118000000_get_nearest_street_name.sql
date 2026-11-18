CREATE OR REPLACE FUNCTION public.get_nearest_street_name(
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION
)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
    SELECT COALESCE(NULLIF(s.name, ''), 'Jalan tanpa nama')
    FROM public.streets AS s
    WHERE p_lat BETWEEN -90 AND 90
      AND p_lng BETWEEN -180 AND 180
      AND ST_DWithin(
          s.coordinates::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          50
      )
    ORDER BY s.coordinates::geography
        <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_nearest_street_name(
    DOUBLE PRECISION, DOUBLE PRECISION
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearest_street_name(
    DOUBLE PRECISION, DOUBLE PRECISION
) TO anon, authenticated;
