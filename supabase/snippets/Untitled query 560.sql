--random hapus nanti 

-- Mencari jalan dengan nama Segara Ayu
-- Aman: hanya membaca tabel streets

SELECT
    uuid,
    osm_way_id,
    name,
    ST_GeometryType(coordinates) AS tipe_geometri
FROM public.streets
WHERE name ILIKE '%Segara Ayu%';


-- Mengecek laporan yang sudah bisa ditampilkan Home
-- Hanya membaca data, tidak mengubah database

SELECT
    street_name,
    status,
    category,
    road_geojson->>'type' AS tipe_jalan,
    marker_geojson->>'type' AS tipe_marker
FROM public.get_home_road_segments();



-- ==========================================
-- DATA UJI PENUTUPAN JALAN TUKAD NYALI
-- ==========================================

WITH jalan_uji AS (
    -- Memilih satu ruas Jalan Tukad Nyali
    SELECT uuid
    FROM public.streets
    WHERE name ILIKE '%Tukad Nyali%'
      AND coordinates IS NOT NULL
      AND ST_NPoints(coordinates) >= 2
      AND ST_Length(coordinates) > 0
    ORDER BY ST_Length(coordinates) DESC
    LIMIT 1
),

laporan_uji AS (
    -- Membuat laporan uji berstatus ditutup
    INSERT INTO public.reports (
        category,
        status,
        description
    )
    SELECT
        'Perbaikan',
        'open',
        'TEST_HOME_TUKAD_NYALI'
    FROM jalan_uji
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.reports
        WHERE description = 'TEST_HOME_TUKAD_NYALI'
    )
    RETURNING uuid
)

-- Menghubungkan laporan dengan ruas jalan OSM
INSERT INTO public.report_street_segments (
    report_uuid,
    street_uuid,
    start_fraction,
    end_fraction
)
SELECT
    l.uuid,
    j.uuid,
    0.25,
    0.75
FROM laporan_uji l
CROSS JOIN jalan_uji j
RETURNING
    report_uuid,
    street_uuid,
    start_fraction,
    end_fraction;


-- Hapus laporan pengujian Tukad Nyali saja
-- Tidak menghapus data jalan dari tabel streets

DELETE FROM public.reports
WHERE description = 'TEST_HOME_TUKAD_NYALI'
RETURNING uuid, description;
