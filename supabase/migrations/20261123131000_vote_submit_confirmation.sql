-- Votes may be repeated after a cooldown; status comes from fresh votes only.
DROP FUNCTION public.submit_report_confirmation(UUID, BOOLEAN);

CREATE FUNCTION public.submit_report_confirmation(
    p_report_uuid UUID,
    p_is_still_closed BOOLEAN
)
RETURNS TABLE (
    report_status TEXT,
    closed_count BIGINT,
    open_count BIGINT,
    confirmation_recorded BOOLEAN,
    next_vote_at TIMESTAMPTZ
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
BEGIN
    IF voter_uuid IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2001',
            MESSAGE = 'Silakan buat sesi anonim untuk mengirim konfirmasi';
    END IF;

    -- Row lock serializes concurrent votes on the same report.
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

    -- Expire at the first interaction after the deadline even if the cron job
    -- has not reached this row yet. No vote is stored in this branch.
    IF COALESCE(report_row.last_confirmed_at, report_row.dt_created)
        <= NOW() - public.report_expiry_interval(report_row.category) THEN
        UPDATE public.reports AS r
        SET status = 'expired'
        WHERE r.uuid = p_report_uuid;

        RETURN QUERY
        SELECT 'expired'::TEXT,
               COUNT(*) FILTER (WHERE v.is_still_closed),
               COUNT(*) FILTER (WHERE NOT v.is_still_closed),
               FALSE,
               NULL::TIMESTAMPTZ
        FROM public.report_fresh_votes(p_report_uuid, NOW()) AS v;
        RETURN;
    END IF;

    IF public.report_next_vote_at(p_report_uuid, voter_uuid) > NOW() THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2004',
            MESSAGE = 'Kamu baru saja vote untuk laporan ini';
    END IF;

    INSERT INTO public.report_confirmations (report_uuid, user_uuid, is_still_closed)
    VALUES (p_report_uuid, voter_uuid, p_is_still_closed);

    SELECT COUNT(*) FILTER (WHERE v.is_still_closed),
           COUNT(*) FILTER (WHERE NOT v.is_still_closed)
    INTO votes_closed, votes_open
    FROM public.report_fresh_votes(p_report_uuid, NOW()) AS v;

    next_status := public.compute_report_status(votes_open, votes_closed);

    UPDATE public.reports AS r
    SET status = next_status,
        -- Only "closed" evidence keeps a report alive.
        last_confirmed_at = CASE
            WHEN p_is_still_closed THEN NOW()
            ELSE r.last_confirmed_at
        END,
        actual_opened_at = CASE
            WHEN next_status = 'open' AND report_row.status <> 'open' THEN NOW()
            ELSE r.actual_opened_at
        END
    WHERE r.uuid = p_report_uuid;

    RETURN QUERY
    SELECT next_status::TEXT, votes_closed, votes_open, TRUE,
           public.report_next_vote_at(p_report_uuid, voter_uuid);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_report_confirmation(UUID, BOOLEAN)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_report_confirmation(UUID, BOOLEAN)
TO authenticated;

NOTIFY pgrst, 'reload schema';
