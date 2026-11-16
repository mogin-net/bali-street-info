
-- TEST HOME: Satu laporan sementara
-- Hanya untuk pengujian lokal

WITH test_street AS (
    SELECT uuid
    FROM public.streets
    WHERE name = 'Jalan Sedap Malam'
      AND coordinates IS NOT NULL
      AND ST_NPoints(coordinates) >= 3
    ORDER BY ST_NPoints(coordinates) DESC
    LIMIT 1
),
test_report AS (
    INSERT INTO public.reports (
        category,
        status,
        description
    )
    SELECT
        'Perbaikan',
        'closed',
        'TEST_HOME_SANUR_HAPUS_SETELAH_UJI'
    FROM test_street
    RETURNING uuid
)
INSERT INTO public.report_street_segments (
    report_uuid,
    street_uuid,
    start_fraction,
    end_fraction
)
SELECT
    r.uuid,
    s.uuid,
    0.25,
    0.75
FROM test_report r
CROSS JOIN test_street s
RETURNING
    report_uuid,
    street_uuid,
    start_fraction,
    end_fraction;
