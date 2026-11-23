BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(22);

CREATE TEMP TABLE coverage_test_roads (
    scenario TEXT PRIMARY KEY,
    street_uuid UUID NOT NULL DEFAULT gen_random_uuid()
) ON COMMIT DROP;

INSERT INTO coverage_test_roads (scenario)
VALUES
    ('overlap'),
    ('nonoverlap'),
    ('contained'),
    ('triple'),
    ('touching'),
    ('identical'),
    ('status_filter'),
    ('temporal_filter'),
    ('multi_way_a'),
    ('multi_way_b'),
    ('no_votes'),
    ('invalid_geometry'),
    ('empty_geometry'),
    ('zero_length');

INSERT INTO public.streets (uuid, osm_way_id, name, coordinates)
SELECT
    test_road.street_uuid,
    9000000000000000000::BIGINT
        + ROW_NUMBER() OVER (ORDER BY test_road.scenario),
    '__coverage_union_test__' || test_road.scenario,
    CASE test_road.scenario
        WHEN 'invalid_geometry' THEN
            ST_GeomFromText('LINESTRING(115.25 -8.70, 115.27 95)', 4326)
        WHEN 'empty_geometry' THEN
            ST_GeomFromText('LINESTRING EMPTY', 4326)
        WHEN 'zero_length' THEN
            ST_GeomFromText('LINESTRING(115.25 -8.70, 115.25 -8.70)', 4326)
        ELSE ST_GeomFromText('LINESTRING(115.25 -8.70, 115.27 -8.70)', 4326)
    END
FROM coverage_test_roads AS test_road;

CREATE TEMP TABLE coverage_test_reports (
    report_case TEXT PRIMARY KEY,
    report_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    report_status VARCHAR(20) NOT NULL DEFAULT 'closed',
    dt_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_confirmed_at TIMESTAMPTZ,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ
) ON COMMIT DROP;

INSERT INTO coverage_test_reports (
    report_case, report_status, dt_created, valid_from, valid_until
)
VALUES
    ('overlap_a', 'closed', NOW(), NULL, NULL),
    ('overlap_b', 'closed', NOW(), NULL, NULL),
    ('nonoverlap_a', 'closed', NOW(), NULL, NULL),
    ('nonoverlap_b', 'closed', NOW(), NULL, NULL),
    ('contained_a', 'closed', NOW(), NULL, NULL),
    ('contained_b', 'closed', NOW(), NULL, NULL),
    ('triple_a', 'closed', NOW(), NULL, NULL),
    ('triple_b', 'closed', NOW(), NULL, NULL),
    ('triple_c', 'closed', NOW(), NULL, NULL),
    ('touching_a', 'closed', NOW(), NULL, NULL),
    ('touching_b', 'closed', NOW(), NULL, NULL),
    ('identical_a', 'closed', NOW(), NULL, NULL),
    ('identical_b', 'closed', NOW(), NULL, NULL),
    ('status_closed', 'closed', NOW(), NULL, NULL),
    ('status_open', 'open', NOW(), NULL, NULL),
    ('status_expired', 'expired', NOW(), NULL, NULL),
    ('time_active', 'closed', NOW(), NULL, NULL),
    ('time_future_start', 'closed', NOW(), NOW() + INTERVAL '1 day', NULL),
    ('time_past_end', 'closed', NOW(), NULL, NOW() - INTERVAL '1 second'),
    ('time_stale', 'closed', NOW() - INTERVAL '73 hours', NULL, NULL),
    ('multi_way_report', 'closed', NOW(), NULL, NULL),
    ('no_votes_report', 'closed', NOW(), NULL, NULL),
    ('invalid_geometry_report', 'closed', NOW(), NULL, NULL),
    ('empty_geometry_report', 'closed', NOW(), NULL, NULL),
    ('zero_length_report', 'closed', NOW(), NULL, NULL);

INSERT INTO public.reports (
    uuid,
    category,
    dt_created,
    last_confirmed_at,
    valid_from,
    valid_until,
    status
)
SELECT
    test_report.report_uuid,
    'Tes union interval',
    test_report.dt_created,
    test_report.last_confirmed_at,
    test_report.valid_from,
    test_report.valid_until,
    test_report.report_status
FROM coverage_test_reports AS test_report;

CREATE TEMP TABLE coverage_test_intervals (
    report_case TEXT NOT NULL,
    road_case TEXT NOT NULL,
    start_fraction DOUBLE PRECISION NOT NULL,
    end_fraction DOUBLE PRECISION NOT NULL
) ON COMMIT DROP;

INSERT INTO coverage_test_intervals
    (report_case, road_case, start_fraction, end_fraction)
VALUES
    ('overlap_a', 'overlap', 0.0, 0.5),
    ('overlap_b', 'overlap', 0.3, 0.8),
    ('nonoverlap_a', 'nonoverlap', 0.0, 0.2),
    ('nonoverlap_b', 'nonoverlap', 0.5, 0.8),
    ('contained_a', 'contained', 0.0, 0.8),
    ('contained_b', 'contained', 0.2, 0.4),
    ('triple_a', 'triple', 0.1, 0.5),
    ('triple_b', 'triple', 0.35, 0.75),
    ('triple_c', 'triple', 0.7, 0.9),
    ('touching_a', 'touching', 0.0, 0.3),
    ('touching_b', 'touching', 0.3, 0.6),
    ('identical_a', 'identical', 0.2, 0.7),
    ('identical_b', 'identical', 0.2, 0.7),
    ('status_closed', 'status_filter', 0.0, 0.5),
    ('status_open', 'status_filter', 0.3, 0.8),
    ('status_expired', 'status_filter', 0.8, 1.0),
    ('time_active', 'temporal_filter', 0.0, 0.25),
    ('time_future_start', 'temporal_filter', 0.25, 0.5),
    ('time_past_end', 'temporal_filter', 0.5, 0.75),
    ('time_stale', 'temporal_filter', 0.75, 1.0),
    ('multi_way_report', 'multi_way_a', 0.1, 0.4),
    ('multi_way_report', 'multi_way_b', 0.4, 0.8),
    ('no_votes_report', 'no_votes', 0.0, 0.2),
    ('invalid_geometry_report', 'invalid_geometry', 0.0, 0.5),
    ('empty_geometry_report', 'empty_geometry', 0.0, 0.5),
    ('zero_length_report', 'zero_length', 0.0, 0.5);

INSERT INTO public.report_street_segments (
    report_uuid,
    street_uuid,
    start_fraction,
    end_fraction
)
SELECT
    test_report.report_uuid,
    test_road.street_uuid,
    test_interval.start_fraction,
    test_interval.end_fraction
FROM coverage_test_intervals AS test_interval
JOIN coverage_test_reports AS test_report
    ON test_report.report_case = test_interval.report_case
JOIN coverage_test_roads AS test_road
    ON test_road.scenario = test_interval.road_case;

-- Multiple confirmations must never multiply a report's contribution.
INSERT INTO public.report_confirmations (
    report_uuid,
    user_uuid,
    is_still_closed
)
SELECT test_report.report_uuid, NULL::UUID, TRUE
FROM coverage_test_reports AS test_report
WHERE test_report.report_case = 'overlap_a'
UNION ALL
SELECT test_report.report_uuid, NULL::UUID, FALSE
FROM coverage_test_reports AS test_report
WHERE test_report.report_case = 'overlap_a';

SELECT is(
    (
        SELECT coverage.covered_fraction
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario = 'overlap'
    ),
    0.8::DOUBLE PRECISION,
    'overlap intervals [0,0.5) and [0.3,0.8) union to 0.8'
);

SELECT is(
    (
        SELECT coverage.contributing_report_count
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario = 'overlap'
    ),
    2::BIGINT,
    'overlap counts distinct reports, not confirmation rows'
);

SELECT is(
    (
        SELECT coverage.merged_intervals
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario = 'overlap'
    ),
    '[[0, 0.8]]'::JSONB,
    'overlap returns the merged interval'
);

SELECT ok(
    ABS(
        (
            SELECT coverage.covered_length_m
            FROM public.get_closed_road_coverage() AS coverage
            JOIN coverage_test_roads AS test_road
                ON test_road.street_uuid = coverage.street_uuid
            WHERE test_road.scenario = 'overlap'
        )
        -
        (
            SELECT ST_Length(
                ST_LineSubstring(street.coordinates, 0.0, 0.8)::GEOGRAPHY,
                TRUE
            )
            FROM public.streets AS street
            JOIN coverage_test_roads AS test_road
                ON test_road.street_uuid = street.uuid
            WHERE test_road.scenario = 'overlap'
        )
    ) < 0.001,
    'affected length uses PostGIS geography length of the merged geometry'
);

SELECT ok(
    ABS(
        (
            SELECT coverage.coverage_percent
            FROM public.get_closed_road_coverage() AS coverage
            JOIN coverage_test_roads AS test_road
                ON test_road.street_uuid = coverage.street_uuid
            WHERE test_road.scenario = 'overlap'
        ) - 80.0
    ) < 0.001,
    'overlap percentage is 80 percent'
);

SELECT is(
    (
        SELECT coverage.covered_fraction
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario = 'nonoverlap'
    ),
    0.5::DOUBLE PRECISION,
    'non-overlapping intervals sum to 0.5'
);

SELECT is(
    (
        SELECT coverage.covered_fraction
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario = 'contained'
    ),
    0.8::DOUBLE PRECISION,
    'an interval inside another contributes no extra coverage'
);

SELECT is(
    (
        SELECT coverage.covered_fraction
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario = 'triple'
    ),
    0.8::DOUBLE PRECISION,
    'three overlapping intervals union to 0.8'
);

SELECT is(
    (
        SELECT coverage.covered_fraction
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario = 'touching'
    ),
    0.6::DOUBLE PRECISION,
    'touching intervals merge without a gap or double count'
);

SELECT is(
    (
        SELECT coverage.covered_fraction
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario = 'identical'
    ),
    0.5::DOUBLE PRECISION,
    'identical intervals count once'
);

SELECT is(
    (
        SELECT coverage.covered_fraction
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario = 'status_filter'
    ),
    0.5::DOUBLE PRECISION,
    'only closed reports contribute; open and expired reports are excluded'
);

SELECT is(
    (
        SELECT coverage.contributing_report_count
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario = 'status_filter'
    ),
    1::BIGINT,
    'report count applies the same status filter'
);

SELECT is(
    (
        SELECT coverage.covered_fraction
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario = 'temporal_filter'
    ),
    0.25::DOUBLE PRECISION,
    'future, ended, and 72-hour-stale reports are excluded'
);

SELECT is(
    (
        SELECT coverage.contributing_report_count
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario = 'temporal_filter'
    ),
    1::BIGINT,
    'temporal filter counts only the currently valid report'
);

SELECT is(
    (
        SELECT COUNT(*)::BIGINT
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario IN ('multi_way_a', 'multi_way_b')
    ),
    2::BIGINT,
    'a report across two streets is aggregated independently per street'
);

SELECT is(
    (
        SELECT SUM(coverage.covered_fraction)
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario IN ('multi_way_a', 'multi_way_b')
    ),
    0.7::DOUBLE PRECISION,
    'fractions from separate streets are not merged together'
);

SELECT is(
    (
        SELECT coverage.covered_fraction
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario = 'no_votes'
    ),
    0.2::DOUBLE PRECISION,
    'existing default closed status remains the source of truth for a new report'
);

SELECT is(
    (
        SELECT COUNT(*)::BIGINT
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario IN (
            'invalid_geometry', 'empty_geometry', 'zero_length'
        )
    ),
    0::BIGINT,
    'invalid, empty, and zero-length road geometries are skipped safely'
);

SELECT is(
    (
        SELECT COUNT(*)::BIGINT
        FROM public.reports AS report
        JOIN coverage_test_reports AS test_report
            ON test_report.report_uuid = report.uuid
        WHERE test_report.report_case IN ('overlap_a', 'overlap_b')
          AND report.status = 'closed'
    ),
    2::BIGINT,
    'coverage calculation leaves both source reports unchanged'
);

UPDATE public.reports AS report
SET status = 'open'
FROM coverage_test_reports AS test_report
WHERE test_report.report_case = 'overlap_a'
  AND report.uuid = test_report.report_uuid;

SELECT is(
    (
        SELECT coverage.covered_fraction
        FROM public.get_closed_road_coverage() AS coverage
        JOIN coverage_test_roads AS test_road
            ON test_road.street_uuid = coverage.street_uuid
        WHERE test_road.scenario = 'overlap'
    ),
    0.5::DOUBLE PRECISION,
    'changing one report to open removes only its interval from the union'
);

SELECT is(
    (
        SELECT report.status
        FROM public.reports AS report
        JOIN coverage_test_reports AS test_report
            ON test_report.report_uuid = report.uuid
        WHERE test_report.report_case = 'overlap_b'
    ),
    'closed'::VARCHAR(20),
    'changing one report status does not change another report'
);

SELECT is(
    (
        SELECT COUNT(*)::BIGINT
        FROM public.reports AS report
        JOIN coverage_test_reports AS test_report
            ON test_report.report_uuid = report.uuid
        WHERE test_report.report_case IN ('overlap_a', 'overlap_b')
    ),
    2::BIGINT,
    'status changes do not merge or delete report records'
);

SELECT * FROM finish();

ROLLBACK;
