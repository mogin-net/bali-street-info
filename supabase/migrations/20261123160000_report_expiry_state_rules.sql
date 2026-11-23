-- Correct the existing 72-hour expiry rules without adding new expiry state,
-- changing table structure, or creating a duplicate Cron job.
CREATE OR REPLACE FUNCTION public.submit_report_confirmation(
    p_report_uuid UUID,
    p_is_still_closed BOOLEAN
)
RETURNS TABLE (
    report_status TEXT,
    closed_count BIGINT,
    open_count BIGINT,
    confirmation_recorded BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
    voter_uuid UUID := auth.uid();
    report_row public.reports%ROWTYPE;
    next_status VARCHAR(20);
    votes_closed BIGINT;
    votes_open BIGINT;
    activity_time TIMESTAMPTZ := statement_timestamp();
    expiry_anchor TIMESTAMPTZ;
BEGIN
    IF voter_uuid IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2001',
            MESSAGE = 'Silakan buat sesi anonim untuk mengirim konfirmasi';
    END IF;

    SELECT r.*
    INTO report_row
    FROM public.reports AS r
    WHERE r.uuid = p_report_uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2002',
            MESSAGE = 'Laporan tidak ditemukan';
    END IF;

    IF report_row.status = 'expired' THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2003',
            MESSAGE = 'Laporan sudah kedaluwarsa';
    END IF;

    expiry_anchor := CASE report_row.status
        WHEN 'open' THEN COALESCE(
            report_row.actual_opened_at,
            report_row.last_confirmed_at,
            report_row.dt_created
        )
        ELSE COALESCE(report_row.last_confirmed_at, report_row.dt_created)
    END;

    -- Treat the first request after the deadline as an expiry boundary too;
    -- this closes the small gap between the exact deadline and the next Cron run.
    IF expiry_anchor <= activity_time - INTERVAL '72 hours' THEN
        UPDATE public.reports AS r
        SET status = 'expired'
        WHERE r.uuid = p_report_uuid
          AND r.status IN ('closed', 'open');

        WITH latest_vote_per_user AS (
            SELECT DISTINCT ON (c.user_uuid)
                c.user_uuid,
                c.is_still_closed
            FROM public.report_confirmations AS c
            WHERE c.report_uuid = p_report_uuid
              AND c.user_uuid IS NOT NULL
            ORDER BY c.user_uuid, c.dt_created DESC, c.uuid DESC
        )
        SELECT
            COUNT(*) FILTER (WHERE v.is_still_closed),
            COUNT(*) FILTER (WHERE NOT v.is_still_closed)
        INTO votes_closed, votes_open
        FROM latest_vote_per_user AS v;

        RETURN QUERY SELECT 'expired'::TEXT,
            COALESCE(votes_closed, 0), COALESCE(votes_open, 0), FALSE;
        RETURN;
    END IF;

    WITH latest_vote_per_user AS (
        SELECT DISTINCT ON (c.user_uuid)
            c.user_uuid,
            c.is_still_closed
        FROM public.report_confirmations AS c
        WHERE c.report_uuid = p_report_uuid
          AND c.user_uuid IS NOT NULL
        ORDER BY c.user_uuid, c.dt_created DESC, c.uuid DESC
    )
    SELECT
        COUNT(*) FILTER (WHERE v.is_still_closed),
        COUNT(*) FILTER (WHERE NOT v.is_still_closed)
    INTO votes_closed, votes_open
    FROM latest_vote_per_user AS v;

    IF EXISTS (
        SELECT 1
        FROM public.report_confirmations AS c
        WHERE c.report_uuid = p_report_uuid
          AND c.user_uuid = voter_uuid
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2004',
            MESSAGE = 'Anda sudah mengirim konfirmasi untuk laporan ini';
    END IF;

    INSERT INTO public.report_confirmations (
        report_uuid,
        user_uuid,
        is_still_closed
    )
    VALUES (
        p_report_uuid,
        voter_uuid,
        p_is_still_closed
    );

    IF p_is_still_closed THEN
        votes_closed := votes_closed + 1;
    ELSE
        votes_open := votes_open + 1;
    END IF;

    next_status := CASE
        WHEN votes_closed > votes_open THEN 'closed'
        WHEN votes_open > votes_closed THEN 'open'
        ELSE report_row.status
    END;

    UPDATE public.reports AS r
    SET status = next_status,
        last_confirmed_at = activity_time,
        actual_opened_at = CASE
            WHEN next_status = 'open' AND report_row.status <> 'open'
                THEN activity_time
            -- For legacy open reports missing actual_opened_at, freeze the
            -- best timestamp available before last_confirmed_at moves forward.
            WHEN next_status = 'open'
                THEN COALESCE(
                    r.actual_opened_at,
                    report_row.last_confirmed_at,
                    report_row.dt_created
                )
            WHEN next_status = 'closed'
                THEN NULL
            ELSE r.actual_opened_at
        END
    WHERE r.uuid = p_report_uuid;

    RETURN QUERY
    SELECT next_status::TEXT, votes_closed, votes_open, TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_report_confirmation(UUID, BOOLEAN)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_report_confirmation(UUID, BOOLEAN)
TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_stale_reports()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    expired_rows INTEGER;
    expiry_time TIMESTAMPTZ := statement_timestamp() - INTERVAL '72 hours';
BEGIN
    WITH eligible_reports AS MATERIALIZED (
        SELECT r.uuid
        FROM public.reports AS r
        WHERE (
            r.status = 'closed'
            AND COALESCE(r.last_confirmed_at, r.dt_created) <= expiry_time
        ) OR (
            r.status = 'open'
            AND COALESCE(
                r.actual_opened_at,
                r.last_confirmed_at,
                r.dt_created
            ) <= expiry_time
        )
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.reports AS r
    SET status = 'expired'
    FROM eligible_reports AS eligible
    WHERE r.uuid = eligible.uuid
      AND r.status IN ('closed', 'open');

    GET DIAGNOSTICS expired_rows = ROW_COUNT;
    RETURN expired_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_reports()
FROM PUBLIC, anon, authenticated;

-- Keep the existing get_home_road_segments contract and stored geometry
-- snapshots, while hiding reports whose 72-hour window has elapsed even if
-- Cron's next run has not happened yet.
CREATE OR REPLACE FUNCTION public.get_home_road_segments()
RETURNS TABLE (
    street_id UUID,
    street_name VARCHAR(150),
    report_id UUID,
    segment_id UUID,
    segment_order INTEGER,
    status VARCHAR(20),
    category VARCHAR(50),
    road_geojson JSONB,
    marker_geojson JSONB,
    start_marker_geojson JSONB,
    end_marker_geojson JSONB
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
    WITH active AS (
        SELECT rs.*, r.uuid AS report_id, r.status, r.category,
               r.snapped_start_point, r.snapped_end_point,
               s.uuid AS street_id, s.name AS street_name,
               COALESCE(rs.geometry_snapshot,
                   ST_LineSubstring(s.coordinates, rs.start_fraction, rs.end_fraction)) AS route_geom
        FROM public.report_street_segments AS rs
        JOIN public.streets AS s ON s.uuid = rs.street_uuid
        JOIN public.reports AS r ON r.uuid = rs.report_uuid
        WHERE r.status IN ('closed', 'open')
          AND r.dt_created <= statement_timestamp()
          AND (r.valid_from IS NULL OR r.valid_from <= statement_timestamp())
          AND (r.valid_until IS NULL OR r.valid_until > statement_timestamp())
          AND CASE r.status
              WHEN 'closed' THEN COALESCE(r.last_confirmed_at, r.dt_created)
                  > statement_timestamp() - INTERVAL '72 hours'
              WHEN 'open' THEN COALESCE(
                  r.actual_opened_at,
                  r.last_confirmed_at,
                  r.dt_created
              ) > statement_timestamp() - INTERVAL '72 hours'
              ELSE FALSE
          END
    ), marked AS (
        SELECT active.*,
               row_number() OVER (PARTITION BY report_id ORDER BY segment_order, uuid) AS first_segment,
               row_number() OVER (PARTITION BY report_id ORDER BY segment_order DESC, uuid DESC) AS last_segment
        FROM active
    )
    SELECT street_id, street_name, report_id, uuid, segment_order,
           status, category,
           ST_AsGeoJSON(route_geom)::JSONB,
           ST_AsGeoJSON(ST_LineInterpolatePoint(route_geom, 0.5))::JSONB,
           CASE WHEN first_segment = 1 THEN ST_AsGeoJSON(COALESCE(
               snapped_start_point, ST_StartPoint(route_geom)))::JSONB END,
           CASE WHEN last_segment = 1 THEN ST_AsGeoJSON(COALESCE(
               snapped_end_point, ST_EndPoint(route_geom)))::JSONB END
    FROM marked;
$$;

REVOKE ALL ON FUNCTION public.get_home_road_segments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_road_segments()
TO anon, authenticated;
