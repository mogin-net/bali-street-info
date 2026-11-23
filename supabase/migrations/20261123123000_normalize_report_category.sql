-- Store report categories in one canonical lowercase form, matching the report
-- form values, so the home filter (r.category = p_category) finds them.
UPDATE public.reports
SET category = CASE
        WHEN lower(btrim(category)) IN ('perbaikan', 'upacara', 'bencana', 'event', 'lainnya')
            THEN lower(btrim(category))
        -- Unknown categories never matched any home filter; file them under "lainnya".
        ELSE 'lainnya'
    END
WHERE category NOT IN ('perbaikan', 'upacara', 'bencana', 'event', 'lainnya');

ALTER TABLE public.reports
    ALTER COLUMN category SET DEFAULT 'lainnya',
    ADD CONSTRAINT chk_reports_category
        CHECK (category IN ('perbaikan', 'upacara', 'bencana', 'event', 'lainnya'));

CREATE OR REPLACE FUNCTION public.submit_street_report(
    p_start_lat DOUBLE PRECISION,
    p_start_lng DOUBLE PRECISION,
    p_end_lat DOUBLE PRECISION,
    p_end_lng DOUBLE PRECISION,
    p_category TEXT,
    p_is_car_forbidden BOOLEAN,
    p_is_motorcycle_forbidden BOOLEAN,
    p_description TEXT,
    p_network_version TIMESTAMPTZ,
    p_route_signature TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
    v_route JSONB;
    v_report UUID;
    v_version TIMESTAMPTZ;
    v_segment JSONB;
BEGIN
    v_route := public.resolve_street_report_route(p_start_lat, p_start_lng, p_end_lat, p_end_lng);
    v_version := (v_route->>'network_version')::TIMESTAMPTZ;
    IF p_network_version IS NULL OR p_network_version IS DISTINCT FROM v_version
       OR p_route_signature IS NULL
       OR p_route_signature IS DISTINCT FROM (v_route->>'route_signature') THEN
        RAISE EXCEPTION USING ERRCODE = 'P1006', MESSAGE = 'Data jalan berubah setelah preview. Periksa ulang jalur sebelum mengirim laporan.';
    END IF;

    INSERT INTO public.reports (
        user_uuid, category, is_car_forbidden, is_motorcycle_forbidden,
        description, status, original_start_point, original_end_point,
        snapped_start_point, snapped_end_point, start_snap_distance_m,
        end_snap_distance_m, osm_network_version
    ) VALUES (
        auth.uid(), COALESCE(NULLIF(lower(BTRIM(p_category)), ''), 'lainnya'),
        COALESCE(p_is_car_forbidden, TRUE), COALESCE(p_is_motorcycle_forbidden, TRUE),
        NULLIF(BTRIM(p_description), ''), 'closed',
        ST_SetSRID(ST_MakePoint(p_start_lng, p_start_lat), 4326),
        ST_SetSRID(ST_MakePoint(p_end_lng, p_end_lat), 4326),
        ST_GeomFromGeoJSON((v_route->'snapped_start')::TEXT),
        ST_GeomFromGeoJSON((v_route->'snapped_end')::TEXT),
        (v_route->>'start_snap_distance_m')::DOUBLE PRECISION,
        (v_route->>'end_snap_distance_m')::DOUBLE PRECISION,
        v_version
    ) RETURNING uuid INTO v_report;

    FOR v_segment IN SELECT value FROM jsonb_array_elements(v_route->'segments') LOOP
        INSERT INTO public.report_street_segments (
            report_uuid, street_uuid, start_fraction, end_fraction,
            segment_order, is_reversed, geometry_snapshot
        ) VALUES (
            v_report, (v_segment->>'street_uuid')::UUID,
            (v_segment->>'start_fraction')::DOUBLE PRECISION,
            (v_segment->>'end_fraction')::DOUBLE PRECISION,
            (v_segment->>'segment_order')::INTEGER,
            (v_segment->>'is_reversed')::BOOLEAN,
            ST_SetSRID(ST_GeomFromGeoJSON((v_segment->'geometry')::TEXT), 4326)
        );
    END LOOP;
    RETURN v_report;
END;
$$;
