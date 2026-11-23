-- Analytical coverage only: source reports and segments remain independent.
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
        WHERE report.status = 'closed'
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
              > statement_timestamp() - INTERVAL '72 hours'
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
