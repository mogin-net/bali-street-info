BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(25);

-- R = reporter, A/B/C = voters.
INSERT INTO auth.users (id) VALUES
    ('00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-000000000003'),
    ('00000000-0000-0000-0000-000000000004');

CREATE FUNCTION pg_temp.act_as(p_user UUID) RETURNS VOID LANGUAGE SQL AS $$
    SELECT set_config(
               'request.jwt.claims',
               CASE WHEN p_user IS NULL THEN ''
                    ELSE json_build_object('sub', p_user, 'role', 'authenticated')::TEXT
               END,
               true
           ),
           set_config('request.jwt.claim.sub', COALESCE(p_user::TEXT, ''), true);
$$;

-- ---------------------------------------------------------------------------
-- Task 1: status rule and helper functions
-- ---------------------------------------------------------------------------

SELECT is(public.compute_report_status(1, 0), 'maybe_open', '1-0 maybe_open');
SELECT is(public.compute_report_status(1, 1), 'maybe_open', '1-1 maybe_open');
SELECT is(public.compute_report_status(2, 0), 'open', '2-0 open');
SELECT is(public.compute_report_status(2, 1), 'open', '2-1 open');
SELECT is(public.compute_report_status(3, 2), 'open', '3-2 open');
SELECT is(public.compute_report_status(2, 2), 'maybe_open', 'tie 2-2 never open');
SELECT is(public.compute_report_status(3, 3), 'maybe_open', 'tie 3-3 never open');
SELECT is(public.compute_report_status(0, 1), 'closed', '0-1 closed');
SELECT is(public.compute_report_status(1, 2), 'closed', '1-2 closed');
SELECT is(public.compute_report_status(0, 0), 'closed', '0-0 closed');

SELECT is(public.report_vote_window('upacara'), INTERVAL '3 hours', 'upacara window 3h');
SELECT is(public.report_vote_window('event'), INTERVAL '3 hours', 'event window 3h');
SELECT is(public.report_vote_window('lainnya'), INTERVAL '12 hours', 'lainnya window 12h');
SELECT is(public.report_vote_window('perbaikan'), INTERVAL '48 hours', 'perbaikan window 48h');
SELECT is(public.report_vote_window('bencana'), INTERVAL '48 hours', 'bencana window 48h');
SELECT is(public.report_expiry_interval('upacara'), INTERVAL '12 hours', 'upacara expiry 12h');
SELECT is(public.report_expiry_interval('lainnya'), INTERVAL '48 hours', 'lainnya expiry 48h');
SELECT is(public.report_expiry_interval('perbaikan'), INTERVAL '7 days', 'perbaikan expiry 7d');

INSERT INTO public.reports (uuid, category, user_uuid, dt_created, status) VALUES
    ('10000000-0000-0000-0000-000000000001', 'upacara', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 hour', 'closed'),
    ('10000000-0000-0000-0000-000000000002', 'upacara', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '4 hours', 'closed'),
    ('10000000-0000-0000-0000-000000000003', 'upacara', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '150 minutes', 'closed'),
    ('10000000-0000-0000-0000-000000000004', 'upacara', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '2 hours', 'closed'),
    ('10000000-0000-0000-0000-000000000005', 'upacara', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 hour', 'closed'),
    ('10000000-0000-0000-0000-000000000006', 'upacara', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '10 minutes', 'closed');

INSERT INTO public.report_confirmations (report_uuid, user_uuid, is_still_closed, dt_created) VALUES
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', TRUE, NOW() - INTERVAL '2 hours'),
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', FALSE, NOW() - INTERVAL '1 hour'),
    ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', FALSE, NOW() - INTERVAL '1 hour'),
    ('10000000-0000-0000-0000-000000000005', NULL, FALSE, NOW() - INTERVAL '10 minutes'),
    ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', FALSE, NOW() - INTERVAL '10 minutes');

SELECT results_eq(
    $$SELECT is_still_closed, voted_at, is_reporter_vote
      FROM public.report_fresh_votes('10000000-0000-0000-0000-000000000001', NOW())$$,
    $$VALUES (TRUE, NOW() - INTERVAL '1 hour', TRUE)$$,
    'reporter counts as a fresh closed vote'
);

SELECT is_empty(
    $$SELECT 1 FROM public.report_fresh_votes('10000000-0000-0000-0000-000000000002', NOW())$$,
    'reporter vote outside the 3h upacara window is ignored'
);

SELECT results_eq(
    $$SELECT is_still_closed
      FROM public.report_fresh_votes('10000000-0000-0000-0000-000000000003', NOW())
      WHERE NOT is_reporter_vote$$,
    $$VALUES (FALSE)$$,
    'only the latest vote per user counts'
);

SELECT is_empty(
    $$SELECT 1 FROM public.report_fresh_votes('10000000-0000-0000-0000-000000000004', NOW())
      WHERE is_still_closed$$,
    'reporter re-vote replaces the virtual closed vote'
);

SELECT is(
    (SELECT COUNT(*) FROM public.report_fresh_votes('10000000-0000-0000-0000-000000000005', NOW())),
    1::BIGINT,
    'votes without user_uuid are ignored'
);

SELECT results_eq(
    $$SELECT public.report_next_vote_at('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002'),
             public.report_next_vote_at('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001'),
             public.report_next_vote_at('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003')$$,
    $$VALUES (NOW() + INTERVAL '20 minutes', NOW() + INTERVAL '20 minutes', NULL::TIMESTAMPTZ)$$,
    'next vote time: voter, reporter, and someone who never voted'
);

SELECT lives_ok(
    $$UPDATE public.reports SET status = 'maybe_open'
      WHERE uuid = '10000000-0000-0000-0000-000000000001'$$,
    'reports.status accepts maybe_open'
);

SELECT * FROM finish();

ROLLBACK;
