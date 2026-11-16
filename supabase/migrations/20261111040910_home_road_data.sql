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

        -- Geometri ruas yang terdampak
        -- Format GeoJSON:
        -- [longitude, latitude]
        ST_AsGeoJSON(
            g.road_segment
        )::JSONB AS road_geojson,

        -- Titik tengah ruas terdampak
        -- Dihitung pada fraksi 0.5
        ST_AsGeoJSON(
            ST_LineInterpolatePoint(
                g.road_segment,
                0.5
            )
        )::JSONB AS marker_geojson

    FROM public.report_street_segments rs

    -- Menghubungkan ruas laporan dengan jalan
    JOIN public.streets s
        ON rs.street_uuid = s.uuid

    -- Menghubungkan ruas dengan laporan
    JOIN public.reports r
        ON rs.report_uuid = r.uuid

    -- Memotong geometri sesuai fraksi laporan
    CROSS JOIN LATERAL (
        SELECT ST_LineSubstring(
            s.coordinates,
            rs.start_fraction,
            rs.end_fraction
        ) AS road_segment
    ) g

    -- Status yang ditampilkan pada Home
    WHERE r.status IN ('closed', 'open');
$$;

-- ==========================================
-- HAK AKSES RPC
-- ==========================================

-- Mencabut izin default dari PUBLIC
REVOKE ALL
ON FUNCTION public.get_home_road_segments()
FROM PUBLIC;

-- Pengunjung tanpa login dapat membaca RPC
-- authenticated disediakan sebagai izin tambahan
GRANT EXECUTE
ON FUNCTION public.get_home_road_segments()
TO anon, authenticated;


-- ==========================================
-- FUNGSI IMPOR JALAN OPENSTREETMAP
-- ==========================================

CREATE OR REPLACE FUNCTION public.import_osm_streets(
    p_streets JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $function$
DECLARE
    affected_rows INTEGER;
BEGIN
    INSERT INTO public.streets (
        osm_way_id,
        name,
        coordinates
    )
    SELECT
        (item->>'osm_way_id')::BIGINT,
        NULLIF(item->>'name', ''),
        ST_SetSRID(
            ST_GeomFromGeoJSON(
                (item->'geometry')::TEXT
            ),
            4326
        )
    FROM jsonb_array_elements(p_streets) AS item

    ON CONFLICT (osm_way_id)
    DO UPDATE SET
        name = EXCLUDED.name,
        coordinates = EXCLUDED.coordinates,
        dt_updated = NOW();

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    RETURN affected_rows;
END;
$function$;

-- HAK AKSES FUNGSI IMPOR OSM

-- Pengunjung tidak boleh menjalankan fungsi impor
REVOKE ALL ON FUNCTION
    public.import_osm_streets(JSONB)
FROM PUBLIC;

REVOKE ALL ON FUNCTION
    public.import_osm_streets(JSONB)
FROM anon, authenticated;

-- Hanya backend dengan service_role
-- yang diizinkan menjalankan fungsi impor
GRANT EXECUTE ON FUNCTION
    public.import_osm_streets(JSONB)
TO service_role;
