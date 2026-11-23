BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);

CREATE TEMP TABLE route_test_ids (
    case_name TEXT PRIMARY KEY,
    street_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    osm_way_id BIGINT NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO route_test_ids (case_name, osm_way_id)
VALUES
    ('near_but_disconnected', 9100000000000000001),
    ('connected_start', 9100000000000000002),
    ('connected_end', 9100000000000000003),
    ('isolated_start', 9100000000000000004),
    ('isolated_end', 9100000000000000005);

INSERT INTO public.streets (uuid, osm_way_id, name, coordinates, osm_node_ids)
SELECT ids.street_uuid, ids.osm_way_id,
       CASE ids.case_name
           WHEN 'near_but_disconnected' THEN 'Jalan Paralel Terdekat'
           WHEN 'connected_start' THEN 'Jalan Paralel Terhubung'
           WHEN 'connected_end' THEN 'Jalan Sambungan'
           WHEN 'isolated_start' THEN 'Jalan Terputus A'
           ELSE 'Jalan Terputus B'
       END,
       CASE ids.case_name
           WHEN 'near_but_disconnected' THEN ST_GeomFromText('LINESTRING(115.2600 -8.680000,115.2610 -8.680000)', 4326)
           WHEN 'connected_start' THEN ST_GeomFromText('LINESTRING(115.2600 -8.680020,115.2610 -8.680020)', 4326)
           WHEN 'connected_end' THEN ST_GeomFromText('LINESTRING(115.2610 -8.680020,115.2620 -8.680020)', 4326)
           WHEN 'isolated_start' THEN ST_GeomFromText('LINESTRING(115.2630 -8.680000,115.2640 -8.680000)', 4326)
           ELSE ST_GeomFromText('LINESTRING(115.2641 -8.680000,115.2650 -8.680000)', 4326)
       END,
       CASE ids.case_name
           WHEN 'near_but_disconnected' THEN ARRAY[8100000000000001, 8100000000000002]::BIGINT[]
           WHEN 'connected_start' THEN ARRAY[8200000000000001, 8200000000000002]::BIGINT[]
           WHEN 'connected_end' THEN ARRAY[8200000000000002, 8200000000000003]::BIGINT[]
           WHEN 'isolated_start' THEN ARRAY[8300000000000001, 8300000000000002]::BIGINT[]
           ELSE ARRAY[8400000000000001, 8400000000000002]::BIGINT[]
       END
FROM route_test_ids AS ids;

CREATE TEMP TABLE route_test_result AS
SELECT public.resolve_street_report_route(
    -8.680009, 115.2602,
    -8.680020, 115.2618
) AS route;

SELECT is(
    (SELECT route->>'start_street_name' FROM route_test_result),
    'Jalan Paralel Terhubung',
    'routing selects the connected candidate when a slightly closer parallel road is disconnected'
);

SELECT ok(
    (SELECT (route->>'start_candidate_count')::INTEGER = 2 FROM route_test_result),
    'both nearby endpoint candidates are considered'
);

SELECT ok(
    (SELECT (route->>'start_snap_distance_m')::DOUBLE PRECISION <= 5
        AND (route->>'end_snap_distance_m')::DOUBLE PRECISION <= 5
     FROM route_test_result),
    'both endpoints obey the five meter snap limit'
);

SELECT is(
    (SELECT jsonb_array_length(route->'segments') FROM route_test_result),
    2,
    'connected route is returned as two ordered OSM Way segments'
);

CREATE TEMP TABLE route_test_saved (report_uuid UUID NOT NULL) ON COMMIT DROP;
INSERT INTO route_test_saved
SELECT public.submit_street_report(
    -8.680009, 115.2602,
    -8.680020, 115.2618,
    'Lainnya', TRUE, TRUE, NULL,
    (route->>'network_version')::TIMESTAMPTZ,
    route->>'route_signature'
)
FROM route_test_result;

SELECT is(
    (SELECT count(*)::INTEGER
     FROM public.report_street_segments AS segment
     JOIN route_test_saved AS saved ON saved.report_uuid = segment.report_uuid),
    2,
    'submission persists all route segments in one report'
);

CREATE TEMP TABLE route_test_snapshots ON COMMIT DROP AS
SELECT segment.segment_order, segment.geometry_snapshot
FROM public.report_street_segments AS segment
JOIN route_test_saved AS saved ON saved.report_uuid = segment.report_uuid;

UPDATE public.streets AS street
SET dt_updated = NOW() + INTERVAL '1 minute'
FROM route_test_ids AS ids
WHERE ids.osm_way_id = street.osm_way_id
  AND ids.case_name IN ('connected_start', 'connected_end');

SELECT throws_ok(
    $$SELECT public.submit_street_report(
        -8.680009, 115.2602, -8.680020, 115.2618,
        'Lainnya', TRUE, TRUE, NULL,
        (SELECT (route->>'network_version')::TIMESTAMPTZ FROM route_test_result),
        (SELECT route->>'route_signature' FROM route_test_result)
    )$$,
    'P1006',
    'Data jalan berubah setelah preview. Periksa ulang jalur sebelum mengirim laporan.',
    'submission rejects a stale preview after an OSM import changes the network'
);

UPDATE public.streets AS street
SET coordinates = ST_Translate(street.coordinates, 0.0001, 0),
    dt_updated = NOW() + INTERVAL '2 minutes'
FROM route_test_ids AS ids
WHERE ids.osm_way_id = street.osm_way_id
  AND ids.case_name IN ('connected_start', 'connected_end');

SELECT ok(
    (SELECT count(*) = 2
            AND bool_and(home.road_geojson = ST_AsGeoJSON(saved.geometry_snapshot)::JSONB)
     FROM public.get_home_road_segments() AS home
     JOIN route_test_saved AS report ON report.report_uuid = home.report_id
     JOIN route_test_snapshots AS saved ON saved.segment_order = home.segment_order),
    'homepage uses saved geometry snapshots after source OSM geometry changes'
);

SELECT ok(
    (SELECT count(*) FILTER (WHERE start_marker_geojson IS NOT NULL) = 1
            AND count(*) FILTER (WHERE end_marker_geojson IS NOT NULL) = 1
     FROM public.get_home_road_segments() AS home
     JOIN route_test_saved AS report ON report.report_uuid = home.report_id),
    'homepage returns the persisted snapped start and end markers once per route'
);

SELECT throws_ok(
    $$SELECT public.resolve_street_report_route(-8.6801, 115.2602, -8.680020, 115.2618)$$,
    'P1003',
    'Titik terlalu jauh dari jalan. Batas snapping adalah 5 meter.',
    'a location beyond the snap limit is rejected'
);

SELECT throws_ok(
    $$SELECT public.resolve_street_report_route(-8.680000, 115.2635, -8.680000, 115.2645)$$,
    'P1005',
    'Tidak ditemukan jalur jalan yang terhubung antara titik awal dan titik akhir.',
    'visually close roads without shared OSM nodes are not connected'
);

SELECT * FROM finish();
ROLLBACK;
