
-- ==========================================
-- SERVER-SIDE FILTER KATEGORI BACKEND HOME
-- ==========================================

-- Perubahan:
-- 1. Menambahkan parameter p_category
-- 2. Memindahkan filter kategori ke PostgreSQL
-- 3. Mempertahankan filter status
-- 4. Mempertahankan format GeoJSON untuk Home

BEGIN;

-- Mengganti fungsi lama tanpa parameter.
-- Tidak menghapus data dari tabel database.
DROP FUNCTION IF EXISTS
    public.get_home_road_segments();

CREATE FUNCTION public.get_home_road_segments(
    p_category TEXT DEFAULT NULL
)
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
SECURITY INVOKER
AS $$
    SELECT
        -- Identitas jalan dan laporan
        s.uuid AS street_id,
        s.name AS street_name,
        r.uuid AS report_id,
        rs.uuid AS segment_id,

        -- Status dan kategori laporan
        r.status,
        r.category,

        -- Geometri bagian jalan yang terdampak
        ST_AsGeoJSON(
            g.road_segment
        )::JSONB AS road_geojson,

        -- Titik tengah bagian jalan terdampak
        ST_AsGeoJSON(
            ST_LineInterpolatePoint(
                g.road_segment,
                0.5
            )
        )::JSONB AS marker_geojson

    FROM public.report_street_segments rs

    JOIN public.streets s
        ON rs.street_uuid = s.uuid

    JOIN public.reports r
        ON rs.report_uuid = r.uuid

    -- Memotong jalan sesuai titik awal dan akhir laporan
    CROSS JOIN LATERAL (
        SELECT ST_LineSubstring(
            s.coordinates,
            rs.start_fraction,
            rs.end_fraction
        ) AS road_segment
    ) g

    -- Filter yang dijalankan di backend
    WHERE r.status IN ('closed', 'open')
      AND (
          p_category IS NULL
          OR r.category = p_category
      );
$$;

-- ==========================================
-- HAK AKSES RPC HOME
-- ==========================================

-- Batasi izin default
REVOKE ALL
ON FUNCTION public.get_home_road_segments(TEXT)
FROM PUBLIC;

-- Izinkan pengunjung tanpa login mengakses RPC
GRANT EXECUTE
ON FUNCTION public.get_home_road_segments(TEXT)
TO anon, authenticated;

-- Memperbarui cache schema Supabase API
NOTIFY pgrst, 'reload schema';

COMMIT;
