-- Read paths follow the fresh-vote rules: maybe_open is active (and still
-- counts as closed for coverage), expiry depends on the report category.

-- Detail: fresh votes per side for the "who said what, when" panel, plus the
-- caller's own cooldown. Voter identities stay hidden.
DROP FUNCTION public.get_report_detail(UUID);

CREATE FUNCTION public.get_report_detail(p_report_uuid UUID)
RETURNS TABLE (
    report_id UUID,
    street_name TEXT,
    category VARCHAR(50),
    report_status VARCHAR(20),
    description TEXT,
    dt_created TIMESTAMPTZ,
    is_car_forbidden BOOLEAN,
    is_motorcycle_forbidden BOOLEAN,
    closed_count BIGINT,
    open_count BIGINT,
    last_closed_vote_at TIMESTAMPTZ,
    last_open_vote_at TIMESTAMPTZ,
    closed_is_reporter_only BOOLEAN,
    my_next_vote_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
    SELECT
        r.uuid,
        COALESCE(
            string_agg(DISTINCT COALESCE(s.name, 'Jalan tanpa nama'), ', '),
            'Jalan tanpa nama'
        ),
        r.category,
        r.status,
        r.description,
        r.dt_created,
        r.is_car_forbidden,
        r.is_motorcycle_forbidden,
        v.closed_count,
        v.open_count,
        v.last_closed_vote_at,
        v.last_open_vote_at,
        v.closed_is_reporter_only,
        CASE WHEN n.next_at > NOW() THEN n.next_at END
    FROM public.reports AS r
    LEFT JOIN public.report_street_segments AS rs
        ON rs.report_uuid = r.uuid
    LEFT JOIN public.streets AS s
        ON s.uuid = rs.street_uuid
    CROSS JOIN LATERAL (
        SELECT
            COUNT(*) FILTER (WHERE f.is_still_closed) AS closed_count,
            COUNT(*) FILTER (WHERE NOT f.is_still_closed) AS open_count,
            MAX(f.voted_at) FILTER (WHERE f.is_still_closed) AS last_closed_vote_at,
            MAX(f.voted_at) FILTER (WHERE NOT f.is_still_closed) AS last_open_vote_at,
            COUNT(*) FILTER (WHERE f.is_still_closed) = 1
                AND COALESCE(bool_or(f.is_still_closed AND f.is_reporter_vote), FALSE)
                AS closed_is_reporter_only
        FROM public.report_fresh_votes(r.uuid, NOW()) AS f
    ) AS v
    CROSS JOIN LATERAL (
        SELECT public.report_next_vote_at(r.uuid, auth.uid()) AS next_at
    ) AS n
    WHERE r.uuid = p_report_uuid
    GROUP BY r.uuid, v.closed_count, v.open_count, v.last_closed_vote_at,
             v.last_open_vote_at, v.closed_is_reporter_only, n.next_at;
$$;

REVOKE ALL ON FUNCTION public.get_report_detail(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_detail(UUID)
TO anon, authenticated;

-- Home map: maybe_open is shown; report_created_at feeds the nearby-vote card.
DROP FUNCTION public.get_home_road_segments(TEXT);

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
    end_marker_geojson JSONB,
    report_created_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
    WITH active AS (
        SELECT rs.*, r.uuid AS report_id, r.status, r.category,
               r.dt_created AS report_created_at,
               r.snapped_start_point, r.snapped_end_point,
               s.uuid AS street_id, s.name AS street_name,
               COALESCE(rs.geometry_snapshot,
                   ST_LineSubstring(s.coordinates, rs.start_fraction, rs.end_fraction)) AS route_geom
        FROM public.report_street_segments AS rs
        JOIN public.streets AS s ON s.uuid = rs.street_uuid
        JOIN public.reports AS r ON r.uuid = rs.report_uuid
        WHERE r.status IN ('closed', 'maybe_open', 'open')
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
               snapped_end_point, ST_EndPoint(route_geom)))::JSONB END,
           report_created_at
    FROM marked;
$$;

REVOKE ALL ON FUNCTION public.get_home_road_segments(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_road_segments(TEXT) TO anon, authenticated;

-- Expiry job: per-category deadline since the last "closed" activity.
CREATE OR REPLACE FUNCTION public.expire_stale_reports()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    expired_rows INTEGER;
BEGIN
    UPDATE public.reports AS r
    SET status = 'expired'
    WHERE r.status IN ('closed', 'maybe_open', 'open')
      AND COALESCE(r.last_confirmed_at, r.dt_created)
          <= NOW() - public.report_expiry_interval(r.category);

    GET DIAGNOSTICS expired_rows = ROW_COUNT;
    RETURN expired_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_reports() FROM PUBLIC, anon, authenticated;

-- Coverage: body copied from 20261120123000; only active_reports changed.
CREATE OR REPLACE FUNCTION public.get_closed_road_coverage()
RETURNS TABLE (
    street_uuid UUID,
    osm_way_id BIGINT,
    street_name VARCHAR(150),
    road_length_m DOUBLE PRECISION,
    covered_fraction DOUBLE PRECISION,
    covered_length_m DOUBLE PRECISION,
    coverage_percent DOUBLE PRECISION,
    contributing_report_count BIGINT,
    merged_intervals JSONB
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
    WITH active_reports AS MATERIALIZED (
        SELECT report.uuid
        FROM public.reports AS report
        WHERE report.status IN ('closed', 'maybe_open')
          AND report.dt_created <= statement_timestamp()
          AND (
              report.valid_from IS NULL
              OR report.valid_from <= statement_timestamp()
          )
          AND (
              report.valid_until IS NULL
              OR report.valid_until > statement_timestamp()
          )
          AND COALESCE(report.last_confirmed_at, report.dt_created)
              > statement_timestamp() - public.report_expiry_interval(report.category)
    ),
    street_interval_unions AS (
        SELECT
            segment.street_uuid,
            range_agg(
                numrange(
                    segment.start_fraction::NUMERIC,
                    segment.end_fraction::NUMERIC,
                    '[)'
                )
            ) AS union_ranges,
            COUNT(DISTINCT segment.report_uuid) AS report_count
        FROM public.report_street_segments AS segment
        JOIN active_reports AS report
            ON report.uuid = segment.report_uuid
        GROUP BY segment.street_uuid
    ),
    safe_street_geometries AS MATERIALIZED (
        SELECT
            street.uuid,
            street.osm_way_id,
            street.name,
            CASE
                WHEN ST_IsEmpty(street.coordinates) THEN
                    NULL::GEOMETRY
                WHEN ST_NPoints(street.coordinates) < 2 THEN
                    NULL::GEOMETRY
                WHEN NOT ST_IsValid(street.coordinates) THEN
                    NULL::GEOMETRY
                WHEN ST_XMin(Box3D(street.coordinates)) < -180 THEN
                    NULL::GEOMETRY
                WHEN ST_XMax(Box3D(street.coordinates)) > 180 THEN
                    NULL::GEOMETRY
                WHEN ST_YMin(Box3D(street.coordinates)) < -90 THEN
                    NULL::GEOMETRY
                WHEN ST_YMax(Box3D(street.coordinates)) > 90 THEN
                    NULL::GEOMETRY
                ELSE street.coordinates
            END AS safe_coordinates
        FROM public.streets AS street
    ),
    valid_streets AS MATERIALIZED (
        SELECT
            safe.uuid,
            safe.osm_way_id,
            safe.name,
            safe.safe_coordinates AS coordinates,
            ST_Length(safe.safe_coordinates::GEOGRAPHY, TRUE) AS road_length_m
        FROM safe_street_geometries AS safe
        WHERE safe.safe_coordinates IS NOT NULL
    ),
    measurable_streets AS MATERIALIZED (
        SELECT
            valid.uuid,
            valid.osm_way_id,
            valid.name,
            valid.coordinates,
            valid.road_length_m
        FROM valid_streets AS valid
        WHERE valid.road_length_m > 0
    ),
    union_pieces AS (
        SELECT
            unions.street_uuid,
            unions.report_count,
            piece.coverage_range,
            LOWER(piece.coverage_range) AS fraction_start,
            UPPER(piece.coverage_range) AS fraction_end
        FROM street_interval_unions AS unions
        CROSS JOIN LATERAL UNNEST(unions.union_ranges)
            AS piece(coverage_range)
    ),
    measured_coverage AS (
        SELECT
            street.uuid,
            street.osm_way_id,
            street.name,
            street.road_length_m,
            piece.report_count,
            SUM(piece.fraction_end - piece.fraction_start)
                AS union_fraction,
            SUM(
                ST_Length(
                    ST_LineSubstring(
                        street.coordinates,
                        piece.fraction_start::DOUBLE PRECISION,
                        piece.fraction_end::DOUBLE PRECISION
                    )::GEOGRAPHY,
                    TRUE
                )
            ) AS union_length_m,
            JSONB_AGG(
                JSONB_BUILD_ARRAY(
                    piece.fraction_start,
                    piece.fraction_end
                )
                ORDER BY piece.fraction_start
            ) AS interval_list
        FROM union_pieces AS piece
        JOIN measurable_streets AS street
            ON street.uuid = piece.street_uuid
        GROUP BY
            street.uuid,
            street.osm_way_id,
            street.name,
            street.road_length_m,
            piece.report_count
    )
    SELECT
        coverage.uuid,
        coverage.osm_way_id,
        coverage.name,
        coverage.road_length_m,
        LEAST(coverage.union_fraction, 1.0::NUMERIC)::DOUBLE PRECISION,
        LEAST(coverage.union_length_m, coverage.road_length_m),
        LEAST(
            100.0::DOUBLE PRECISION,
            coverage.union_length_m / coverage.road_length_m * 100.0
        ),
        coverage.report_count,
        coverage.interval_list
    FROM measured_coverage AS coverage
    ORDER BY coverage.name NULLS LAST, coverage.osm_way_id;
$$;

REVOKE ALL ON FUNCTION public.get_closed_road_coverage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_closed_road_coverage()
TO anon, authenticated;

COMMENT ON FUNCTION public.get_closed_road_coverage() IS
'Returns closed-road coverage by OSM Way using merged active report intervals; source reports are not combined or changed.';

NOTIFY pgrst, 'reload schema';
