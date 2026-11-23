-- Frontend map: affected road geometry and its midpoint marker as GeoJSON.
CREATE OR REPLACE FUNCTION public.get_home_road_segments()
RETURNS TABLE (
    street_id UUID,
    street_name VARCHAR(150),
    report_id UUID,
    segment_id UUID,
    status VARCHAR(20),
    category VARCHAR(50),
    road_geojson JSONB,
    marker_geojson JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
    SELECT
        s.uuid,
        s.name,
        r.uuid,
        rs.uuid,
        r.status,
        r.category,
        ST_AsGeoJSON(g.road_segment)::JSONB,
        ST_AsGeoJSON(ST_LineInterpolatePoint(g.road_segment, 0.5))::JSONB
    FROM public.report_street_segments AS rs
    JOIN public.streets AS s ON s.uuid = rs.street_uuid
    JOIN public.reports AS r ON r.uuid = rs.report_uuid
    CROSS JOIN LATERAL (
        SELECT ST_LineSubstring(
            s.coordinates, rs.start_fraction, rs.end_fraction
        ) AS road_segment
    ) AS g
    WHERE r.status IN ('closed', 'open');
$$;

REVOKE ALL ON FUNCTION public.get_home_road_segments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_road_segments()
TO anon, authenticated;

-- Used when the user clicks a point on the map to show its road name.
CREATE OR REPLACE FUNCTION public.get_nearest_street_name(
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
    SELECT COALESCE(NULLIF(s.name, ''), 'Jalan tanpa nama')
    FROM public.streets AS s
    WHERE p_lat BETWEEN -90 AND 90
      AND p_lng BETWEEN -180 AND 180
      AND ST_DWithin(
          s.coordinates::GEOGRAPHY,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY,
          50
      )
    ORDER BY s.coordinates::GEOGRAPHY
        <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_nearest_street_name(
    DOUBLE PRECISION, DOUBLE PRECISION
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearest_street_name(
    DOUBLE PRECISION, DOUBLE PRECISION
) TO anon, authenticated;
