-- Vote rules: fresh votes per category decide closed / maybe_open / open.
-- Helpers are internal; only SECURITY DEFINER RPCs call them.

ALTER TABLE public.reports
    DROP CONSTRAINT reports_status_check,
    ADD CONSTRAINT reports_status_check
        CHECK (status IN ('open', 'maybe_open', 'closed', 'expired'));

-- Re-voting is allowed now; the latest vote per user counts.
DROP INDEX IF EXISTS public.idx_confirmations_one_per_user_report;
CREATE INDEX idx_confirmations_report_user_time
    ON public.report_confirmations (report_uuid, user_uuid, dt_created DESC)
    WHERE user_uuid IS NOT NULL;

DROP INDEX IF EXISTS public.idx_reports_active_category;
CREATE INDEX idx_reports_active_category
    ON public.reports (category)
    WHERE status IN ('closed', 'maybe_open', 'open');

CREATE FUNCTION public.report_vote_window(p_category TEXT)
RETURNS INTERVAL
LANGUAGE SQL
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
    SELECT CASE p_category
        WHEN 'upacara' THEN INTERVAL '3 hours'
        WHEN 'event' THEN INTERVAL '3 hours'
        WHEN 'perbaikan' THEN INTERVAL '48 hours'
        WHEN 'bencana' THEN INTERVAL '48 hours'
        ELSE INTERVAL '12 hours'
    END;
$$;

CREATE FUNCTION public.report_expiry_interval(p_category TEXT)
RETURNS INTERVAL
LANGUAGE SQL
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
    SELECT CASE p_category
        WHEN 'upacara' THEN INTERVAL '12 hours'
        WHEN 'event' THEN INTERVAL '12 hours'
        WHEN 'perbaikan' THEN INTERVAL '7 days'
        WHEN 'bencana' THEN INTERVAL '7 days'
        ELSE INTERVAL '48 hours'
    END;
$$;

-- Showing a closed road as open is the costly error, so a tie never opens.
CREATE FUNCTION public.compute_report_status(p_open BIGINT, p_closed BIGINT)
RETURNS VARCHAR(20)
LANGUAGE SQL
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
    SELECT (CASE
        WHEN p_open >= 2 AND p_open > p_closed THEN 'open'
        WHEN p_open >= 1 AND p_open >= p_closed THEN 'maybe_open'
        ELSE 'closed'
    END)::VARCHAR(20);
$$;

-- Latest vote per user inside the category window; the report itself is the
-- reporter's virtual "closed" vote. Voter identities are not returned.
CREATE FUNCTION public.report_fresh_votes(p_report_uuid UUID, p_at TIMESTAMPTZ)
RETURNS TABLE (
    is_still_closed BOOLEAN,
    voted_at TIMESTAMPTZ,
    is_reporter_vote BOOLEAN
)
LANGUAGE SQL
STABLE
SET search_path = pg_catalog, public
AS $$
    WITH all_votes AS (
        SELECT c.user_uuid, c.is_still_closed, c.dt_created AS voted_at,
               FALSE AS is_reporter_vote
        FROM public.report_confirmations AS c
        WHERE c.report_uuid = p_report_uuid
          AND c.user_uuid IS NOT NULL
        UNION ALL
        SELECT r.user_uuid, TRUE, r.dt_created, TRUE
        FROM public.reports AS r
        WHERE r.uuid = p_report_uuid
    ), latest AS (
        SELECT DISTINCT ON (v.user_uuid) v.*
        FROM all_votes AS v
        -- A real vote wins over the virtual one at the same timestamp.
        ORDER BY v.user_uuid, v.voted_at DESC, v.is_reporter_vote
    )
    SELECT l.is_still_closed, l.voted_at, l.is_reporter_vote
    FROM latest AS l
    JOIN public.reports AS r ON r.uuid = p_report_uuid
    WHERE l.voted_at > p_at - public.report_vote_window(r.category);
$$;

-- 30-minute cooldown after the user's last vote; creating the report counts.
CREATE FUNCTION public.report_next_vote_at(p_report_uuid UUID, p_user UUID)
RETURNS TIMESTAMPTZ
LANGUAGE SQL
STABLE
SET search_path = pg_catalog, public
AS $$
    SELECT GREATEST(
        (SELECT MAX(c.dt_created)
         FROM public.report_confirmations AS c
         WHERE c.report_uuid = p_report_uuid
           AND c.user_uuid = p_user),
        (SELECT r.dt_created
         FROM public.reports AS r
         WHERE r.uuid = p_report_uuid
           AND r.user_uuid = p_user)
    ) + INTERVAL '30 minutes';
$$;

REVOKE ALL ON FUNCTION public.report_vote_window(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.report_expiry_interval(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_report_status(BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.report_fresh_votes(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.report_next_vote_at(UUID, UUID) FROM PUBLIC, anon, authenticated;
