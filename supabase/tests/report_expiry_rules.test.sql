BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(23);

CREATE TEMP TABLE expiry_test_reports (
    case_name TEXT PRIMARY KEY,
    report_uuid UUID NOT NULL DEFAULT gen_random_uuid()
) ON COMMIT DROP;

INSERT INTO expiry_test_reports (case_name)
VALUES
    ('closed_71h59'),
    ('closed_72h'),
    ('closed_no_confirmation_72'),
    ('closed_refreshed'),
    ('open_71h59'),
    ('open_72h'),
    ('open_fallback'),
    ('transition_to_open'),
    ('transition_to_closed');

INSERT INTO public.reports (
    uuid, category, status, dt_created, last_confirmed_at, actual_opened_at
)
SELECT test.report_uuid, 'Lainnya',
       CASE test.case_name
           WHEN 'open_71h59' THEN 'open'
           WHEN 'open_72h' THEN 'open'
           WHEN 'open_fallback' THEN 'open'
           WHEN 'transition_to_closed' THEN 'open'
           ELSE 'closed'
       END,
       CASE test.case_name
           WHEN 'closed_71h59' THEN statement_timestamp() - INTERVAL '71 hours 59 minutes'
           WHEN 'closed_72h' THEN statement_timestamp() - INTERVAL '90 hours'
           WHEN 'closed_refreshed' THEN statement_timestamp() - INTERVAL '90 hours'
           WHEN 'closed_no_confirmation_72' THEN statement_timestamp() - INTERVAL '72 hours'
           WHEN 'open_71h59' THEN statement_timestamp() - INTERVAL '90 hours'
           WHEN 'open_72h' THEN statement_timestamp() - INTERVAL '90 hours'
           WHEN 'open_fallback' THEN statement_timestamp() - INTERVAL '90 hours'
           ELSE statement_timestamp() - INTERVAL '1 hour'
       END,
       CASE test.case_name
           WHEN 'closed_72h' THEN statement_timestamp() - INTERVAL '72 hours'
           WHEN 'closed_refreshed' THEN statement_timestamp() - INTERVAL '71 hours 59 minutes'
           WHEN 'open_71h59' THEN statement_timestamp() - INTERVAL '1 hour'
           WHEN 'open_72h' THEN statement_timestamp() - INTERVAL '1 hour'
           WHEN 'open_fallback' THEN statement_timestamp() - INTERVAL '71 hours 59 minutes'
           WHEN 'transition_to_open' THEN statement_timestamp() - INTERVAL '1 hour'
           WHEN 'transition_to_closed' THEN statement_timestamp() - INTERVAL '1 hour'
           ELSE NULL
       END,
       CASE test.case_name
           WHEN 'open_71h59' THEN statement_timestamp() - INTERVAL '71 hours 59 minutes'
           WHEN 'open_72h' THEN statement_timestamp() - INTERVAL '72 hours'
           WHEN 'transition_to_closed' THEN statement_timestamp() - INTERVAL '1 hour'
           ELSE NULL
       END
FROM expiry_test_reports AS test;

CREATE TEMP TABLE expiry_test_roads (
    street_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    osm_way_id BIGINT NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO expiry_test_roads (osm_way_id)
VALUES (9199999999999999000);

INSERT INTO public.streets (uuid, osm_way_id, name, coordinates)
SELECT street_uuid, osm_way_id, 'Expiry test road',
       ST_GeomFromText('LINESTRING(115.26 -8.68,115.261 -8.68)', 4326)
FROM expiry_test_roads;

INSERT INTO public.report_street_segments (
    report_uuid, street_uuid, start_fraction, end_fraction,
    segment_order, geometry_snapshot
)
SELECT test.report_uuid, road.street_uuid,
       CASE test.case_name WHEN 'closed_72h' THEN 0.0 ELSE 0.3 END,
       CASE test.case_name WHEN 'closed_72h' THEN 0.5 ELSE 0.8 END,
       1,
       ST_LineSubstring(street.coordinates,
           CASE test.case_name WHEN 'closed_72h' THEN 0.0 ELSE 0.3 END,
           CASE test.case_name WHEN 'closed_72h' THEN 0.5 ELSE 0.8 END)
FROM expiry_test_reports AS test
CROSS JOIN expiry_test_roads AS road
JOIN public.streets AS street ON street.uuid = road.street_uuid
WHERE test.case_name IN ('closed_72h', 'closed_refreshed', 'open_72h');

SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM public.get_home_road_segments() AS home
        JOIN expiry_test_reports AS test ON test.report_uuid = home.report_id
        WHERE test.case_name = 'open_72h'
    ),
    'Homepage hides an open report at its deadline even before the next Cron run'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.get_home_road_segments() AS home
        JOIN expiry_test_reports AS test ON test.report_uuid = home.report_id
        WHERE test.case_name = 'closed_refreshed' AND home.status = 'closed'
    ),
    'Homepage keeps a closed report active when it was recently confirmed'
);

SELECT is(
    (SELECT merged_intervals
     FROM public.get_closed_road_coverage() AS coverage
     JOIN expiry_test_roads AS road ON road.street_uuid = coverage.street_uuid),
    '[[0.3, 0.8]]'::JSONB,
    'coverage excludes the stale report but retains the active report interval'
);

SELECT is(
    public.expire_stale_reports(),
    3,
    'expiry updates only the three closed/open reports whose correct timestamp is at least 72 hours old'
);

SELECT is(
    (SELECT r.status FROM public.reports AS r JOIN expiry_test_reports AS test
        ON test.report_uuid = r.uuid WHERE test.case_name = 'closed_71h59'),
    'closed',
    'closed report remains active at 71 hours 59 minutes'
);

SELECT is(
    (SELECT r.status FROM public.reports AS r JOIN expiry_test_reports AS test
        ON test.report_uuid = r.uuid WHERE test.case_name = 'closed_72h'),
    'expired',
    'closed report expires at the 72-hour boundary'
);

SELECT is(
    (SELECT r.status FROM public.reports AS r JOIN expiry_test_reports AS test
        ON test.report_uuid = r.uuid WHERE test.case_name = 'closed_no_confirmation_72'),
    'expired',
    'closed report without confirmations uses dt_created as the expiry anchor'
);

SELECT is(
    (SELECT r.status FROM public.reports AS r JOIN expiry_test_reports AS test
        ON test.report_uuid = r.uuid WHERE test.case_name = 'closed_refreshed'),
    'closed',
    'a recent valid confirmation restarts the closed expiry window'
);

SELECT is(
    (SELECT r.status FROM public.reports AS r JOIN expiry_test_reports AS test
        ON test.report_uuid = r.uuid WHERE test.case_name = 'open_71h59'),
    'open',
    'open report remains active at 71 hours 59 minutes from actual_opened_at'
);

SELECT is(
    (SELECT r.status FROM public.reports AS r JOIN expiry_test_reports AS test
        ON test.report_uuid = r.uuid WHERE test.case_name = 'open_72h'),
    'expired',
    'open report expires from actual_opened_at despite a recent confirmation'
);

SELECT is(
    (SELECT r.status FROM public.reports AS r JOIN expiry_test_reports AS test
        ON test.report_uuid = r.uuid WHERE test.case_name = 'open_fallback'),
    'open',
    'legacy open report with missing actual_opened_at uses its latest known timestamp safely'
);

SELECT is(public.expire_stale_reports(), 0,
    'repeated expiry execution does not update already expired reports');

SELECT is(
    (SELECT count(*)::INTEGER FROM public.reports AS r
     JOIN expiry_test_reports AS test ON test.report_uuid = r.uuid),
    9,
    'expiry retains all report records'
);

CREATE TEMP TABLE expiry_test_users (
    user_name TEXT PRIMARY KEY,
    user_uuid UUID NOT NULL DEFAULT gen_random_uuid()
) ON COMMIT DROP;

INSERT INTO expiry_test_users (user_name)
VALUES
    ('closed_vote_1'), ('closed_vote_2'),
    ('open_vote_1'), ('open_vote_2'), ('open_vote_3'), ('open_vote_4'),
    ('transition_open_1'), ('transition_open_2'), ('transition_closed_1'),
    ('transition_closed_2'), ('transition_closed_3');

INSERT INTO auth.users (
    id, instance_id, aud, role, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_anonymous
)
SELECT user_uuid, NULL, 'authenticated', 'authenticated',
       '{"provider":"anonymous","providers":["anonymous"]}'::JSONB,
       '{}'::JSONB, statement_timestamp(), statement_timestamp(), TRUE
FROM expiry_test_users;

CREATE TEMP TABLE expiry_test_transition_results (
    transition_name TEXT NOT NULL,
    status TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO public.report_confirmations (report_uuid, user_uuid, is_still_closed)
SELECT test.report_uuid, users.user_uuid, TRUE
FROM expiry_test_reports AS test
CROSS JOIN expiry_test_users AS users
WHERE test.case_name = 'transition_to_open'
  AND users.user_name IN ('closed_vote_1', 'closed_vote_2');

SELECT set_config('request.jwt.claim.sub',
    (SELECT user_uuid::TEXT FROM expiry_test_users WHERE user_name = 'open_vote_1'), TRUE);
INSERT INTO expiry_test_transition_results
SELECT 'closed_to_open_vote_1', result.report_status
FROM public.submit_report_confirmation(
    (SELECT report_uuid FROM expiry_test_reports WHERE case_name = 'transition_to_open'),
    FALSE
) AS result;

SELECT set_config('request.jwt.claim.sub',
    (SELECT user_uuid::TEXT FROM expiry_test_users WHERE user_name = 'open_vote_2'), TRUE);
INSERT INTO expiry_test_transition_results
SELECT 'closed_to_open_vote_2', result.report_status
FROM public.submit_report_confirmation(
    (SELECT report_uuid FROM expiry_test_reports WHERE case_name = 'transition_to_open'),
    FALSE
) AS result;

SELECT set_config('request.jwt.claim.sub',
    (SELECT user_uuid::TEXT FROM expiry_test_users WHERE user_name = 'open_vote_3'), TRUE);
INSERT INTO expiry_test_transition_results
SELECT 'closed_to_open_vote_3', result.report_status
FROM public.submit_report_confirmation(
    (SELECT report_uuid FROM expiry_test_reports WHERE case_name = 'transition_to_open'),
    FALSE
) AS result;

CREATE TEMP TABLE expiry_test_open_transition_time ON COMMIT DROP AS
SELECT r.actual_opened_at
FROM public.reports AS r
JOIN expiry_test_reports AS test ON test.report_uuid = r.uuid
WHERE test.case_name = 'transition_to_open';

SELECT set_config('request.jwt.claim.sub',
    (SELECT user_uuid::TEXT FROM expiry_test_users WHERE user_name = 'open_vote_4'), TRUE);
INSERT INTO expiry_test_transition_results
SELECT 'open_stays_open_vote', result.report_status
FROM public.submit_report_confirmation(
    (SELECT report_uuid FROM expiry_test_reports WHERE case_name = 'transition_to_open'),
    FALSE
) AS result;

SELECT is(
    (SELECT status FROM expiry_test_transition_results WHERE transition_name = 'closed_to_open_vote_1'),
    'closed', 'a single open vote does not override the closed majority'
);

SELECT is(
    (SELECT status FROM expiry_test_transition_results WHERE transition_name = 'closed_to_open_vote_2'),
    'closed', 'a tied vote preserves the previous closed status'
);

SELECT is(
    (SELECT status FROM expiry_test_transition_results WHERE transition_name = 'closed_to_open_vote_3'),
    'open', 'open majority transitions the report to open'
);

SELECT ok(
    (SELECT r.actual_opened_at >= statement_timestamp() - INTERVAL '1 minute'
     FROM public.reports AS r
     JOIN expiry_test_reports AS test ON test.report_uuid = r.uuid
     WHERE test.case_name = 'transition_to_open'),
    'transition to open records its database timestamp'
);

SELECT ok(
    (SELECT r.actual_opened_at = opened.actual_opened_at
     FROM public.reports AS r
     JOIN expiry_test_reports AS test ON test.report_uuid = r.uuid
     CROSS JOIN expiry_test_open_transition_time AS opened
     WHERE test.case_name = 'transition_to_open'),
    'a later vote that leaves status open does not extend the green marker window'
);

INSERT INTO public.report_confirmations (report_uuid, user_uuid, is_still_closed)
SELECT test.report_uuid, users.user_uuid,
       users.user_name = 'transition_closed_1'
FROM expiry_test_reports AS test
CROSS JOIN expiry_test_users AS users
WHERE test.case_name = 'transition_to_closed'
  AND users.user_name IN ('transition_open_1', 'transition_open_2', 'transition_closed_1');

SELECT set_config('request.jwt.claim.sub',
    (SELECT user_uuid::TEXT FROM expiry_test_users WHERE user_name = 'transition_closed_2'), TRUE);
INSERT INTO expiry_test_transition_results
SELECT 'open_to_closed_tie', result.report_status
FROM public.submit_report_confirmation(
    (SELECT report_uuid FROM expiry_test_reports WHERE case_name = 'transition_to_closed'),
    TRUE
) AS result;

SELECT set_config('request.jwt.claim.sub',
    (SELECT user_uuid::TEXT FROM expiry_test_users WHERE user_name = 'transition_closed_3'), TRUE);
INSERT INTO expiry_test_transition_results
SELECT 'open_to_closed_majority', result.report_status
FROM public.submit_report_confirmation(
    (SELECT report_uuid FROM expiry_test_reports WHERE case_name = 'transition_to_closed'),
    TRUE
) AS result;

SELECT is(
    (SELECT status FROM expiry_test_transition_results WHERE transition_name = 'open_to_closed_tie'),
    'open', 'a tied vote preserves the previous open status'
);

SELECT is(
    (SELECT status FROM expiry_test_transition_results WHERE transition_name = 'open_to_closed_majority'),
    'closed', 'closed majority transitions the report back to closed'
);

SELECT ok(
    (SELECT r.actual_opened_at IS NULL
     FROM public.reports AS r
     JOIN expiry_test_reports AS test ON test.report_uuid = r.uuid
     WHERE test.case_name = 'transition_to_closed'),
    'open-to-closed transition clears actual_opened_at'
);

SELECT ok(
    (SELECT r.last_confirmed_at >= statement_timestamp() - INTERVAL '1 minute'
     FROM public.reports AS r
     JOIN expiry_test_reports AS test ON test.report_uuid = r.uuid
     WHERE test.case_name = 'transition_to_closed'),
    'open-to-closed transition starts a fresh closed expiry window'
);

SELECT is(
    (SELECT count(*)::INTEGER FROM cron.job
     WHERE jobname = 'expire-stale-road-reports' AND active),
    1,
    'the existing expiry Cron job is active exactly once'
);

SELECT * FROM finish();
ROLLBACK;
