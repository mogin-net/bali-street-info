
WITH sample_street AS (
    SELECT
        uuid,
        name,
        coordinates
    FROM public.streets
    WHERE ST_NPoints(coordinates) >= 3
    ORDER BY ST_NPoints(coordinates) DESC
    LIMIT 1
),
road_segment AS (
    SELECT
        uuid AS street_id,
        name AS street_name,
        ST_LineSubstring(
            coordinates,
            0.25,
            0.75
        ) AS geometry
    FROM sample_street
)
SELECT
    street_id,
    street_name,
    'closed' AS status,
    'Perbaikan' AS category,

    ST_AsGeoJSON(geometry)::JSONB
        AS road_geojson,

    ST_AsGeoJSON(
        ST_LineInterpolatePoint(geometry, 0.5)
    )::JSONB AS marker_geojson

FROM road_segment;











SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
      'reports',
      'report_street_segments'
  )
ORDER BY
    table_name,
    ordinal_position;



SELECT
    conrelid::regclass AS table_name,
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (
    'public.reports'::regclass,
    'public.report_street_segments'::regclass
)
AND contype IN ('c', 'f')
ORDER BY table_name, constraint_name;




SELECT
    (
        regexp_matches(
            pg_get_constraintdef(oid),
            '''([^'']+)''',
            'g'
        )
    )[1] AS allowed_status
FROM pg_constraint
WHERE conrelid = 'public.reports'::regclass
  AND conname = 'reports_status_check';

