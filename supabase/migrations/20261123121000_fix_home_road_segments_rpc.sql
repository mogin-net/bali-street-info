-- Unify get_home_road_segments into one category-aware RPC contract.
-- This migration repairs databases that already contain the older overloads.

DROP FUNCTION IF EXISTS public.get_home_road_segments();
DROP FUNCTION IF EXISTS public.get_home_road_segments(TEXT);

CREATE FUNCTION public.get_home_road_segments(p_category TEXT DEFAULT NULL)
RETURNS TABLE (
    street_id UUID,
    street_name VARCHAR(150),
    report_id UUID,
    segment_id UUID,
    segment_order INTEGER,
    status VARCHAR(20),
    category VARCHAR(50),
    road_geojson JSONB,
    marker_geojson JSONB,
    start_marker_geojson JSONB,
    end_marker_geojson JSONB
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
    WITH active AS (
        SELECT rs.*, r.uuid AS report_id, r.status, r.category,
               r.snapped_start_point, r.snapped_end_point,
               s.uuid AS street_id, s.name AS street_name,
               COALESCE(rs.geometry_snapshot,
                   ST_LineSubstring(s.coordinates, rs.start_fraction, rs.end_fraction)) AS route_geom
        FROM public.report_street_segments AS rs
        JOIN public.streets AS s ON s.uuid = rs.street_uuid
        JOIN public.reports AS r ON r.uuid = rs.report_uuid
        WHERE r.status IN ('closed', 'open')
          AND (
              p_category IS NULL
              OR r.category = p_category
          )
    ), marked AS (
        SELECT active.*,
               row_number() OVER (PARTITION BY report_id ORDER BY segment_order, uuid) AS first_segment,
               row_number() OVER (PARTITION BY report_id ORDER BY segment_order DESC, uuid DESC) AS last_segment
        FROM active
    )
    SELECT street_id, street_name, report_id, uuid, segment_order,
           status, category,
           ST_AsGeoJSON(route_geom)::JSONB,
           ST_AsGeoJSON(ST_LineInterpolatePoint(route_geom, 0.5))::JSONB,
           CASE WHEN first_segment = 1 THEN ST_AsGeoJSON(COALESCE(
               snapped_start_point, ST_StartPoint(route_geom)))::JSONB END,
           CASE WHEN last_segment = 1 THEN ST_AsGeoJSON(COALESCE(
               snapped_end_point, ST_EndPoint(route_geom)))::JSONB END
    FROM marked;
$$;

REVOKE ALL ON FUNCTION public.get_home_road_segments(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_road_segments(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
