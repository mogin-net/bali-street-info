
-- =====================================================
-- PETA PENUTUPAN JALAN SANUR
-- DATABASE SETUP - SUPABASE / POSTGRESQL
-- =====================================================


-- =====================================================
-- 1. EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS postgis;


-- =====================================================
-- 2. TABLE: STREETS
-- Identitas ruas jalan dari OpenStreetMap
-- =====================================================

CREATE TABLE public.streets (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    osm_way_id BIGINT NOT NULL UNIQUE,

    name VARCHAR(150),

    coordinates GEOMETRY(LINESTRING, 4326) NOT NULL,

    dt_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    dt_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================================================
-- 3. TABLE: REPORTS
-- Informasi utama laporan penutupan jalan
-- =====================================================

CREATE TABLE public.reports (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_uuid UUID
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    category VARCHAR(50) NOT NULL DEFAULT 'Lainnya',

    is_car_forbidden BOOLEAN NOT NULL DEFAULT TRUE,

    is_motorcycle_forbidden BOOLEAN NOT NULL DEFAULT TRUE,

    description TEXT,

    dt_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_confirmed_at TIMESTAMPTZ,

    valid_from TIMESTAMPTZ,

    valid_until TIMESTAMPTZ,

    actual_opened_at TIMESTAMPTZ,

    status VARCHAR(20) NOT NULL DEFAULT 'closed'
        CHECK (
            status IN (
                'open',
                'closed',
                'expired'
            )
        ),

    CONSTRAINT chk_report_validity
        CHECK (
            valid_until IS NULL
            OR valid_from IS NULL
            OR valid_until > valid_from
        )
);


-- =====================================================
-- 4. TABLE: REPORT_STREET_SEGMENTS
-- Rentang jalan yang terdampak laporan
-- =====================================================

CREATE TABLE public.report_street_segments (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    report_uuid UUID NOT NULL
        REFERENCES public.reports(uuid)
        ON DELETE CASCADE,

    street_uuid UUID NOT NULL
        REFERENCES public.streets(uuid)
        ON DELETE RESTRICT,

    start_fraction DOUBLE PRECISION NOT NULL,

    end_fraction DOUBLE PRECISION NOT NULL,

    CONSTRAINT chk_start_fraction
        CHECK (
            start_fraction >= 0
            AND start_fraction <= 1
        ),

    CONSTRAINT chk_end_fraction
        CHECK (
            end_fraction >= 0
            AND end_fraction <= 1
        ),

    CONSTRAINT chk_segment_direction
        CHECK (
            start_fraction < end_fraction
        ),

    UNIQUE (report_uuid, street_uuid)
);


-- =====================================================
-- 5. TABLE: REPORT_CONFIRMATIONS
-- Jawaban Yes / No dari pengguna
-- =====================================================

CREATE TABLE public.report_confirmations (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    report_uuid UUID NOT NULL
        REFERENCES public.reports(uuid)
        ON DELETE CASCADE,

    user_uuid UUID
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    is_still_closed BOOLEAN NOT NULL,

    dt_created TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================================================
-- 6. INDEXES
-- =====================================================

-- STREETS
CREATE INDEX idx_streets_geometry
    ON public.streets
    USING GIST (coordinates);

CREATE INDEX idx_streets_name
    ON public.streets(name);


-- REPORTS
CREATE INDEX idx_reports_user
    ON public.reports(user_uuid);

CREATE INDEX idx_reports_status
    ON public.reports(status);

CREATE INDEX idx_reports_created
    ON public.reports(dt_created DESC);

CREATE INDEX idx_reports_validity
    ON public.reports(valid_from, valid_until);


-- REPORT STREET SEGMENTS
CREATE INDEX idx_segments_report
    ON public.report_street_segments(report_uuid);

CREATE INDEX idx_segments_street
    ON public.report_street_segments(street_uuid);


-- REPORT CONFIRMATIONS
CREATE INDEX idx_confirmations_report_time
    ON public.report_confirmations(
        report_uuid,
        dt_created DESC
    );

CREATE INDEX idx_confirmations_user
    ON public.report_confirmations(user_uuid)
    WHERE user_uuid IS NOT NULL;

CREATE UNIQUE INDEX idx_confirmations_one_per_user_report
    ON public.report_confirmations(report_uuid, user_uuid)
    WHERE user_uuid IS NOT NULL;


-- =====================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.streets
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reports
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.report_street_segments
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.report_confirmations
    ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 8. GRANT PERMISSIONS
-- =====================================================

REVOKE ALL
ON public.streets,
   public.reports,
   public.report_street_segments,
   public.report_confirmations
FROM PUBLIC, anon, authenticated;

GRANT SELECT
ON public.streets
TO anon, authenticated;

GRANT SELECT
ON public.report_confirmations
TO authenticated;


-- =====================================================
-- 9. RLS: STREETS
-- Data jalan dapat dibaca semua pengunjung
-- =====================================================

CREATE POLICY "Public can read streets"
ON public.streets
FOR SELECT
TO anon, authenticated
USING (TRUE);


-- =====================================================
-- 10. RLS: REPORT CONFIRMATIONS
-- Pengunjung dapat memberikan konfirmasi
-- =====================================================

-- Pengguna login hanya dapat membaca konfirmasinya sendiri
CREATE POLICY "Users can read own confirmations"
ON public.report_confirmations
FOR SELECT
TO authenticated
USING (
    user_uuid = auth.uid()
);


-- =====================================================
-- 11. COMMENTS
-- =====================================================

COMMENT ON TABLE public.streets IS
'Road segments identified by OpenStreetMap Way ID';

COMMENT ON TABLE public.reports IS
'Main road closure reports';

COMMENT ON TABLE public.report_street_segments IS
'Road portions affected by each closure report';

COMMENT ON TABLE public.report_confirmations IS
'Yes or No confirmations regarding road closure reports';

COMMENT ON COLUMN public.report_street_segments.start_fraction IS
'Starting position along the OSM road geometry (0 to 1)';

COMMENT ON COLUMN public.report_street_segments.end_fraction IS
'Ending position along the OSM road geometry (0 to 1)';

COMMENT ON COLUMN public.report_confirmations.is_still_closed IS
'TRUE means still closed; FALSE means road has reopened';


-- =====================================================
-- END OF SETUP
-- =====================================================
