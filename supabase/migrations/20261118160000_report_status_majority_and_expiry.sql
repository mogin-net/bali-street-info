-- One confirmation is accepted per authenticated identity and report.
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
    current_status VARCHAR(20);
    next_status VARCHAR(20);
    votes_closed BIGINT;
    votes_open BIGINT;
    activity_time TIMESTAMPTZ := NOW();
BEGIN
    IF voter_uuid IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2001',
            MESSAGE = 'Silakan buat sesi anonim untuk mengirim konfirmasi';
    END IF;

    SELECT r.status
    INTO current_status
    FROM public.reports AS r
    WHERE r.uuid = p_report_uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2002',
            MESSAGE = 'Laporan tidak ditemukan';
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

    IF current_status = 'expired' THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2003',
            MESSAGE = 'Laporan sudah kedaluwarsa';
    END IF;

    -- Expire at the first interaction after the deadline even if the cron job
    -- has not reached this row yet. No vote is stored in this branch.
    IF COALESCE(
        (SELECT r.last_confirmed_at
         FROM public.reports AS r
         WHERE r.uuid = p_report_uuid),
        (SELECT r.dt_created
         FROM public.reports AS r
         WHERE r.uuid = p_report_uuid)
    ) <= activity_time - INTERVAL '72 hours' THEN
        UPDATE public.reports AS r
        SET status = 'expired'
        WHERE r.uuid = p_report_uuid;

        RETURN QUERY SELECT 'expired'::TEXT, votes_closed, votes_open, FALSE;
        RETURN;
    END IF;

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
        ELSE current_status
    END;

    UPDATE public.reports AS r
    SET status = next_status,
        last_confirmed_at = activity_time,
        actual_opened_at = CASE
            WHEN next_status = 'open' AND current_status <> 'open'
                THEN activity_time
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

-- Public detail data and aggregate counts; individual voter identities remain
-- protected by RLS on report_confirmations.
CREATE OR REPLACE FUNCTION public.get_report_detail(p_report_uuid UUID)
RETURNS TABLE (
    report_id UUID,
    street_name TEXT,
    category VARCHAR(50),
    report_status VARCHAR(20),
    description TEXT,
    dt_created TIMESTAMPTZ,
    is_car_forbidden BOOLEAN,
    is_motorcycle_forbidden BOOLEAN,
    closed_count BIGINT,
    open_count BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
    SELECT
        r.uuid,
        COALESCE(
            string_agg(DISTINCT COALESCE(s.name, 'Jalan tanpa nama'), ', '),
            'Jalan tanpa nama'
        ),
        r.category,
        r.status,
        r.description,
        r.dt_created,
        r.is_car_forbidden,
        r.is_motorcycle_forbidden,
        COALESCE(v.closed_count, 0),
        COALESCE(v.open_count, 0)
    FROM public.reports AS r
    LEFT JOIN public.report_street_segments AS rs
        ON rs.report_uuid = r.uuid
    LEFT JOIN public.streets AS s
        ON s.uuid = rs.street_uuid
    LEFT JOIN LATERAL (
        WITH latest_vote_per_user AS (
            SELECT DISTINCT ON (c.user_uuid)
                c.user_uuid,
                c.is_still_closed
            FROM public.report_confirmations AS c
            WHERE c.report_uuid = r.uuid
              AND c.user_uuid IS NOT NULL
            ORDER BY c.user_uuid, c.dt_created DESC, c.uuid DESC
        )
        SELECT
            COUNT(*) FILTER (WHERE v.is_still_closed) AS closed_count,
            COUNT(*) FILTER (WHERE NOT v.is_still_closed) AS open_count
        FROM latest_vote_per_user AS v
    ) AS v ON TRUE
    WHERE r.uuid = p_report_uuid
    GROUP BY r.uuid, v.closed_count, v.open_count;
$$;

REVOKE ALL ON FUNCTION public.get_report_detail(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_detail(UUID)
TO anon, authenticated;

-- Expiration uses database time and retains all report/confirmation rows.
CREATE OR REPLACE FUNCTION public.expire_stale_reports()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    expired_rows INTEGER;
BEGIN
    UPDATE public.reports AS r
    SET status = 'expired'
    WHERE r.status IN ('closed', 'open')
      AND COALESCE(r.last_confirmed_at, r.dt_created)
          <= NOW() - INTERVAL '72 hours';

    GET DIAGNOSTICS expired_rows = ROW_COUNT;
    RETURN expired_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_reports() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

DO $$
DECLARE
    existing_job_id BIGINT;
BEGIN
    FOR existing_job_id IN
        SELECT jobid FROM cron.job
        WHERE jobname = 'expire-stale-road-reports'
    LOOP
        PERFORM cron.unschedule(existing_job_id);
    END LOOP;

    PERFORM cron.schedule(
        'expire-stale-road-reports',
        '*/10 * * * *',
        'SELECT public.expire_stale_reports();'
    );
END;
$$;
