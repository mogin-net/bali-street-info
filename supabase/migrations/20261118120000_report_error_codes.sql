-- Kode P1xxx menjadi kontrak error yang stabil untuk UI.
CREATE OR REPLACE FUNCTION public.submit_street_report(
    p_start_lat DOUBLE PRECISION,
    p_start_lng DOUBLE PRECISION,
    p_end_lat DOUBLE PRECISION,
    p_end_lng DOUBLE PRECISION,
    p_category TEXT,
    p_is_car_forbidden BOOLEAN,
    p_is_motorcycle_forbidden BOOLEAN,
    p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
    start_point geometry(Point, 4326);
    end_point geometry(Point, 4326);
    middle_point geometry(Point, 4326);
    matched_street public.streets%ROWTYPE;
    start_fraction DOUBLE PRECISION;
    end_fraction DOUBLE PRECISION;
    saved_report_uuid UUID;
BEGIN
    IF p_start_lat IS NULL OR p_start_lng IS NULL
       OR p_end_lat IS NULL OR p_end_lng IS NULL
       OR p_start_lat NOT BETWEEN -90 AND 90
       OR p_end_lat NOT BETWEEN -90 AND 90
       OR p_start_lng NOT BETWEEN -180 AND 180
       OR p_end_lng NOT BETWEEN -180 AND 180
    THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P1001',
            MESSAGE = 'Koordinat lokasi tidak valid';
    END IF;

    start_point := ST_SetSRID(ST_MakePoint(p_start_lng, p_start_lat), 4326);
    end_point := ST_SetSRID(ST_MakePoint(p_end_lng, p_end_lat), 4326);
    middle_point := ST_LineInterpolatePoint(
        ST_MakeLine(start_point, end_point), 0.5
    );

    SELECT s.*
    INTO matched_street
    FROM public.streets AS s
    ORDER BY s.coordinates::geography <-> middle_point::geography
    LIMIT 1;

    IF matched_street.uuid IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P1002',
            MESSAGE = 'Tidak ada jalan di sekitar titik yang dipilih';
    END IF;

    start_fraction := ST_LineLocatePoint(
        matched_street.coordinates,
        ST_ClosestPoint(matched_street.coordinates, start_point)
    );
    end_fraction := ST_LineLocatePoint(
        matched_street.coordinates,
        ST_ClosestPoint(matched_street.coordinates, end_point)
    );

    IF start_fraction > end_fraction THEN
        start_fraction := end_fraction + start_fraction;
        end_fraction := start_fraction - end_fraction;
        start_fraction := start_fraction - end_fraction;
    END IF;

    INSERT INTO public.reports (
        user_uuid,
        category,
        is_car_forbidden,
        is_motorcycle_forbidden,
        description
    )
    VALUES (
        NULL,
        COALESCE(NULLIF(BTRIM(p_category), ''), 'Lainnya'),
        COALESCE(p_is_car_forbidden, TRUE),
        COALESCE(p_is_motorcycle_forbidden, TRUE),
        NULLIF(BTRIM(p_description), '')
    )
    RETURNING uuid INTO saved_report_uuid;

    INSERT INTO public.report_street_segments (
        report_uuid,
        street_uuid,
        start_fraction,
        end_fraction
    )
    VALUES (
        saved_report_uuid,
        matched_street.uuid,
        start_fraction,
        end_fraction
    );

    RETURN saved_report_uuid;
END;
$$;
