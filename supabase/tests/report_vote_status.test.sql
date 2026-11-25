BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(42);

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

-- ---------------------------------------------------------------------------
-- Task 2: submit_report_confirmation
-- ---------------------------------------------------------------------------

INSERT INTO public.reports (uuid, category, user_uuid, dt_created, last_confirmed_at, status) VALUES
    ('20000000-0000-0000-0000-000000000001', 'upacara', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 hour', NULL, 'closed'),
    ('20000000-0000-0000-0000-000000000002', 'upacara', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 hour', NULL, 'closed'),
    ('20000000-0000-0000-0000-000000000003', 'upacara', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '10 minutes', NULL, 'closed'),
    ('20000000-0000-0000-0000-000000000004', 'upacara', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '2 hours', NULL, 'closed'),
    ('20000000-0000-0000-0000-000000000005', 'upacara', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '1 hour', 'closed'),
    ('20000000-0000-0000-0000-000000000006', 'perbaikan', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '1 hour', 'closed'),
    ('20000000-0000-0000-0000-000000000007', 'upacara', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '13 hours', NULL, 'closed'),
    ('20000000-0000-0000-0000-000000000008', 'perbaikan', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '13 hours', NULL, 'closed');

INSERT INTO public.report_confirmations (report_uuid, user_uuid, is_still_closed, dt_created) VALUES
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', TRUE, NOW() - INTERVAL '31 minutes'),
    ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', FALSE, NOW() - INTERVAL '4 hours'),
    ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', FALSE, NOW() - INTERVAL '4 hours');

-- Reporter (closed) + A open → maybe_open
SELECT pg_temp.act_as('00000000-0000-0000-0000-000000000002');
SELECT results_eq(
    $$SELECT report_status, closed_count, open_count, confirmation_recorded, next_vote_at
      FROM public.submit_report_confirmation('20000000-0000-0000-0000-000000000001', FALSE)$$,
    $$VALUES ('maybe_open'::TEXT, 1::BIGINT, 1::BIGINT, TRUE, NOW() + INTERVAL '30 minutes')$$,
    'first open vote → maybe_open'
);

-- + B open → open (2 vs 1)
SELECT pg_temp.act_as('00000000-0000-0000-0000-000000000003');
SELECT results_eq(
    $$SELECT report_status, closed_count, open_count
      FROM public.submit_report_confirmation('20000000-0000-0000-0000-000000000001', FALSE)$$,
    $$VALUES ('open'::TEXT, 1::BIGINT, 2::BIGINT)$$,
    'second open vote → open'
);
SELECT is(
    (SELECT actual_opened_at FROM public.reports WHERE uuid = '20000000-0000-0000-0000-000000000001'),
    NOW(),
    'actual_opened_at set when status becomes open'
);

-- + C closed → 2 vs 2 → maybe_open
SELECT pg_temp.act_as('00000000-0000-0000-0000-000000000004');
SELECT results_eq(
    $$SELECT report_status, closed_count, open_count
      FROM public.submit_report_confirmation('20000000-0000-0000-0000-000000000001', TRUE)$$,
    $$VALUES ('maybe_open'::TEXT, 2::BIGINT, 2::BIGINT)$$,
    'tie 2-2 falls back to maybe_open'
);

SELECT pg_temp.act_as('00000000-0000-0000-0000-000000000002');
SELECT throws_ok(
    $$SELECT * FROM public.submit_report_confirmation('20000000-0000-0000-0000-000000000001', TRUE)$$,
    'P2004', NULL,
    're-vote inside 30 minutes is rejected'
);

SELECT results_eq(
    $$SELECT report_status, confirmation_recorded
      FROM public.submit_report_confirmation('20000000-0000-0000-0000-000000000002', FALSE)$$,
    $$VALUES ('maybe_open'::TEXT, TRUE)$$,
    're-vote after cooldown replaces the earlier closed vote'
);

SELECT pg_temp.act_as('00000000-0000-0000-0000-000000000001');
SELECT throws_ok(
    $$SELECT * FROM public.submit_report_confirmation('20000000-0000-0000-0000-000000000003', FALSE)$$,
    'P2004', NULL,
    'reporter is inside the cooldown right after reporting'
);

SELECT pg_temp.act_as('00000000-0000-0000-0000-000000000002');
SELECT * FROM public.submit_report_confirmation('20000000-0000-0000-0000-000000000004', FALSE);
SELECT is(
    (SELECT last_confirmed_at FROM public.reports WHERE uuid = '20000000-0000-0000-0000-000000000004'),
    NULL,
    'open vote does not extend report life'
);
SELECT pg_temp.act_as('00000000-0000-0000-0000-000000000003');
SELECT * FROM public.submit_report_confirmation('20000000-0000-0000-0000-000000000004', TRUE);
SELECT is(
    (SELECT last_confirmed_at FROM public.reports WHERE uuid = '20000000-0000-0000-0000-000000000004'),
    NOW(),
    'closed vote extends report life'
);

-- Same timestamps, different category windows.
SELECT results_eq(
    $$SELECT report_status
      FROM public.submit_report_confirmation('20000000-0000-0000-0000-000000000005', FALSE)$$,
    $$VALUES ('maybe_open'::TEXT)$$,
    'upacara: 4h and 5h old votes are outside the 3h window'
);
SELECT results_eq(
    $$SELECT report_status
      FROM public.submit_report_confirmation('20000000-0000-0000-0000-000000000006', FALSE)$$,
    $$VALUES ('open'::TEXT)$$,
    'perbaikan: same votes are inside the 48h window'
);

SELECT pg_temp.act_as('00000000-0000-0000-0000-000000000002');
SELECT results_eq(
    $$SELECT report_status, confirmation_recorded, next_vote_at
      FROM public.submit_report_confirmation('20000000-0000-0000-0000-000000000007', FALSE)$$,
    $$VALUES ('expired'::TEXT, FALSE, NULL::TIMESTAMPTZ)$$,
    'upacara report expires 12h after the last closed activity'
);
SELECT is(
    (SELECT status FROM public.reports WHERE uuid = '20000000-0000-0000-0000-000000000007'),
    'expired',
    'expiry is stored'
);
SELECT throws_ok(
    $$SELECT * FROM public.submit_report_confirmation('20000000-0000-0000-0000-000000000007', FALSE)$$,
    'P2003', NULL,
    'expired report rejects votes'
);

SELECT results_eq(
    $$SELECT confirmation_recorded
      FROM public.submit_report_confirmation('20000000-0000-0000-0000-000000000008', FALSE)$$,
    $$VALUES (TRUE)$$,
    'perbaikan report is still active after 13h'
);

SELECT pg_temp.act_as(NULL);
SELECT throws_ok(
    $$SELECT * FROM public.submit_report_confirmation('20000000-0000-0000-0000-000000000008', FALSE)$$,
    'P2001', NULL,
    'vote without a session is rejected'
);

SELECT pg_temp.act_as('00000000-0000-0000-0000-000000000003');
SELECT throws_ok(
    $$SELECT * FROM public.submit_report_confirmation(gen_random_uuid(), FALSE)$$,
    'P2002', NULL,
    'unknown report is rejected'
);

SELECT * FROM finish();

ROLLBACK;
