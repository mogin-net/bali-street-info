-- Resolver timed out on the full Bali network: it built a graph from every
-- street per call. Limit the graph to the area around the endpoints, let the
-- candidate search use the GIST index, and allow zero-length endpoint edges.

CREATE OR REPLACE FUNCTION public.resolve_street_report_route(
    p_start_lat DOUBLE PRECISION,
    p_start_lng DOUBLE PRECISION,
    p_end_lat DOUBLE PRECISION,
    p_end_lng DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
    v_start GEOMETRY(Point, 4326);
    v_end GEOMETRY(Point, 4326);
    v_bbox GEOMETRY;
    v_source BIGINT;
    v_target BIGINT;
    v_current BIGINT;
    v_next BIGINT;
    v_edge_id BIGINT;
    v_network_version TIMESTAMPTZ;
    v_start_near_count INTEGER;
    v_end_near_count INTEGER;
    v_start_candidate_count INTEGER;
    v_end_candidate_count INTEGER;
    v_start_snap GEOMETRY(Point, 4326);
    v_end_snap GEOMETRY(Point, 4326);
    v_start_distance DOUBLE PRECISION;
    v_end_distance DOUBLE PRECISION;
    v_start_alternative_distance DOUBLE PRECISION;
    v_end_alternative_distance DOUBLE PRECISION;
    v_total_cost DOUBLE PRECISION;
    v_route_length DOUBLE PRECISION;
    v_route_signature TEXT;
    v_start_way_id BIGINT;
    v_end_way_id BIGINT;
    v_start_name TEXT;
    v_end_name TEXT;
    v_start_fraction DOUBLE PRECISION;
    v_end_fraction DOUBLE PRECISION;
    v_segments JSONB;
    v_step INTEGER := 0;
BEGIN
    IF p_start_lat IS NULL OR p_start_lng IS NULL
       OR p_end_lat IS NULL OR p_end_lng IS NULL
       OR p_start_lat NOT BETWEEN -90 AND 90
       OR p_end_lat NOT BETWEEN -90 AND 90
       OR p_start_lng NOT BETWEEN -180 AND 180
       OR p_end_lng NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION USING ERRCODE = 'P1001', MESSAGE = 'Koordinat lokasi tidak valid';
    END IF;

    v_start := ST_SetSRID(ST_MakePoint(p_start_lng, p_start_lat), 4326);
    v_end := ST_SetSRID(ST_MakePoint(p_end_lng, p_end_lat), 4326);
    -- shortcut: routes needing a detour > ~1.1 km (0.01 deg) outside the
    -- endpoints' box fail with P1005; widen the margin or retry if that shows up.
    v_bbox := ST_Expand(ST_MakeLine(v_start, v_end), 0.01);

    -- A connection can execute more than one resolver call in a transaction
    -- (for example, a save immediately following a preview in a test).
    DROP TABLE IF EXISTS pg_temp._route_start_candidates;
    DROP TABLE IF EXISTS pg_temp._route_end_candidates;
    DROP TABLE IF EXISTS pg_temp._route_edges;
    DROP TABLE IF EXISTS pg_temp._route_nodes;
    DROP TABLE IF EXISTS pg_temp._route_path;
    DROP TABLE IF EXISTS pg_temp._route_ordered;

    SELECT max(s.dt_updated) INTO v_network_version FROM public.streets AS s;
    IF NOT EXISTS (
        SELECT 1 FROM public.streets AS s
        WHERE cardinality(s.osm_node_ids) >= 2
          AND cardinality(s.osm_node_ids) = ST_NPoints(s.coordinates)
    ) THEN
        RAISE LOG 'street route rejected: OSM topology unavailable; start=(%,%) end=(%,%)', p_start_lat, p_start_lng, p_end_lat, p_end_lng;
        RAISE EXCEPTION USING ERRCODE = 'P1004', MESSAGE = 'Jaringan OSM belum siap. Impor ulang data jalan terlebih dahulu.';
    END IF;

    CREATE TEMP TABLE _route_start_candidates ON COMMIT DROP AS
    SELECT s.uuid AS street_uuid, s.osm_way_id, s.name, s.coordinates,
           s.osm_node_ids,
           ST_LineLocatePoint(s.coordinates, ST_ClosestPoint(s.coordinates, v_start)) AS fraction,
           ST_ClosestPoint(s.coordinates, v_start)::GEOMETRY(Point, 4326) AS snapped,
           ST_Distance(s.coordinates::GEOGRAPHY, v_start::GEOGRAPHY) AS distance_m
    FROM public.streets AS s
    -- The && box (~110 m) lets the GIST index prefilter before the geography check.
    WHERE s.coordinates && ST_Expand(v_start, 0.001)
      AND ST_DWithin(s.coordinates::GEOGRAPHY, v_start::GEOGRAPHY, 50);

    CREATE TEMP TABLE _route_end_candidates ON COMMIT DROP AS
    SELECT s.uuid AS street_uuid, s.osm_way_id, s.name, s.coordinates,
           s.osm_node_ids,
           ST_LineLocatePoint(s.coordinates, ST_ClosestPoint(s.coordinates, v_end)) AS fraction,
           ST_ClosestPoint(s.coordinates, v_end)::GEOMETRY(Point, 4326) AS snapped,
           ST_Distance(s.coordinates::GEOGRAPHY, v_end::GEOGRAPHY) AS distance_m
    FROM public.streets AS s
    WHERE s.coordinates && ST_Expand(v_end, 0.001)
      AND ST_DWithin(s.coordinates::GEOGRAPHY, v_end::GEOGRAPHY, 50);

    SELECT count(*) INTO v_start_near_count FROM pg_temp._route_start_candidates;
    SELECT count(*) INTO v_end_near_count FROM pg_temp._route_end_candidates;
    SELECT count(*) INTO v_start_candidate_count FROM pg_temp._route_start_candidates WHERE distance_m <= 5;
    SELECT count(*) INTO v_end_candidate_count FROM pg_temp._route_end_candidates WHERE distance_m <= 5;

    IF v_start_near_count = 0 OR v_end_near_count = 0 THEN
        RAISE LOG 'street route rejected: no road within search radius; start=(%,%) start_candidates=% end=(%,%) end_candidates=%',
            p_start_lat, p_start_lng, v_start_near_count, p_end_lat, p_end_lng, v_end_near_count;
        RAISE EXCEPTION USING ERRCODE = 'P1002', MESSAGE = 'Tidak ditemukan ruas jalan dalam radius pencarian 50 meter.';
    END IF;
    IF v_start_candidate_count = 0 OR v_end_candidate_count = 0 THEN
        RAISE LOG 'street route rejected: snap limit exceeded; start=(%,%) closest_m=% candidates=% end=(%,%) closest_m=% candidates=%',
            p_start_lat, p_start_lng,
            (SELECT min(distance_m) FROM pg_temp._route_start_candidates), v_start_near_count,
            p_end_lat, p_end_lng,
            (SELECT min(distance_m) FROM pg_temp._route_end_candidates), v_end_near_count;
        RAISE EXCEPTION USING ERRCODE = 'P1003', MESSAGE = 'Titik terlalu jauh dari jalan. Batas snapping adalah 5 meter.';
    END IF;

    DELETE FROM pg_temp._route_start_candidates WHERE distance_m > 5;
    DELETE FROM pg_temp._route_end_candidates WHERE distance_m > 5;
    SELECT distance_m INTO v_start_alternative_distance
    FROM pg_temp._route_start_candidates ORDER BY distance_m, osm_way_id OFFSET 1 LIMIT 1;
    SELECT distance_m INTO v_end_alternative_distance
    FROM pg_temp._route_end_candidates ORDER BY distance_m, osm_way_id OFFSET 1 LIMIT 1;

    -- OSM node IDs are always positive, so negative IDs cannot collide.
    v_source := -1;
    v_target := -2;

    SELECT c.snapped, c.distance_m INTO v_start_snap, v_start_distance
    FROM pg_temp._route_start_candidates AS c ORDER BY c.distance_m, c.osm_way_id LIMIT 1;
    SELECT c.snapped, c.distance_m INTO v_end_snap, v_end_distance
    FROM pg_temp._route_end_candidates AS c ORDER BY c.distance_m, c.osm_way_id LIMIT 1;

    CREATE TEMP TABLE _route_edges (
        id BIGSERIAL PRIMARY KEY,
        source BIGINT NOT NULL,
        target BIGINT NOT NULL,
        cost DOUBLE PRECISION NOT NULL,
        street_uuid UUID NOT NULL,
        osm_way_id BIGINT NOT NULL,
        street_name TEXT,
        fraction_from DOUBLE PRECISION NOT NULL,
        fraction_to DOUBLE PRECISION NOT NULL,
        -- ST_LineSubstring returns a Point when a snap lands exactly on a node;
        -- those zero-length edges are dropped before segments are built.
        geom GEOMETRY NOT NULL
    ) ON COMMIT DROP;

    -- Each consecutive OSM node pair is a graph edge; crossings without a
    -- shared OSM node therefore cannot create false connections.
    INSERT INTO pg_temp._route_edges
        (source, target, cost, street_uuid, osm_way_id, street_name, fraction_from, fraction_to, geom)
    SELECT e.node_a, e.node_b,
           ST_Distance(e.point_a::GEOGRAPHY, e.point_b::GEOGRAPHY),
           e.uuid, e.osm_way_id, e.name, e.fraction_a, e.fraction_b,
           ST_MakeLine(e.point_a, e.point_b)
    FROM (
        SELECT s.uuid, s.osm_way_id, s.name,
               s.osm_node_ids[i] AS node_a, s.osm_node_ids[i + 1] AS node_b,
               ST_PointN(s.coordinates, i)::GEOMETRY(Point, 4326) AS point_a,
               ST_PointN(s.coordinates, i + 1)::GEOMETRY(Point, 4326) AS point_b,
               ST_LineLocatePoint(s.coordinates, ST_PointN(s.coordinates, i)) AS fraction_a,
               ST_LineLocatePoint(s.coordinates, ST_PointN(s.coordinates, i + 1)) AS fraction_b
        FROM public.streets AS s
        CROSS JOIN LATERAL generate_series(1, cardinality(s.osm_node_ids) - 1) AS g(i)
        WHERE s.coordinates && v_bbox
          AND cardinality(s.osm_node_ids) >= 2
          AND cardinality(s.osm_node_ids) = ST_NPoints(s.coordinates)
    ) AS e
    JOIN public.streets AS s ON s.uuid = e.uuid
    WHERE e.node_a <> e.node_b
    ORDER BY e.osm_way_id, e.node_a, e.node_b;

    INSERT INTO pg_temp._route_edges
        (source, target, cost, street_uuid, osm_way_id, street_name, fraction_from, fraction_to, geom)
    SELECT target, source, cost, street_uuid, osm_way_id, street_name,
           fraction_to, fraction_from, ST_Reverse(geom)
    FROM pg_temp._route_edges
    ORDER BY id;

    -- Virtual source and target connect to every node on every valid endpoint
    -- candidate Way. Fractions and snapped distance are included in the cost.
    INSERT INTO pg_temp._route_edges
        (source, target, cost, street_uuid, osm_way_id, street_name, fraction_from, fraction_to, geom)
    SELECT v_source, c.osm_node_ids[g.i],
           c.distance_m + ST_Length(ST_LineSubstring(c.coordinates,
               LEAST(c.fraction, f.node_fraction), GREATEST(c.fraction, f.node_fraction))::GEOGRAPHY),
           c.street_uuid, c.osm_way_id, c.name, c.fraction, f.node_fraction,
           CASE WHEN c.fraction <= f.node_fraction
                THEN ST_LineSubstring(c.coordinates, c.fraction, f.node_fraction)
                ELSE ST_Reverse(ST_LineSubstring(c.coordinates, f.node_fraction, c.fraction)) END
    FROM pg_temp._route_start_candidates AS c
    CROSS JOIN LATERAL generate_subscripts(c.osm_node_ids, 1) AS g(i)
    CROSS JOIN LATERAL (SELECT ST_LineLocatePoint(c.coordinates, ST_PointN(c.coordinates, g.i)) AS node_fraction) AS f
    ORDER BY c.osm_way_id, g.i;

    INSERT INTO pg_temp._route_edges
        (source, target, cost, street_uuid, osm_way_id, street_name, fraction_from, fraction_to, geom)
    SELECT c.osm_node_ids[g.i], v_target,
           c.distance_m + ST_Length(ST_LineSubstring(c.coordinates,
               LEAST(c.fraction, f.node_fraction), GREATEST(c.fraction, f.node_fraction))::GEOGRAPHY),
           c.street_uuid, c.osm_way_id, c.name, f.node_fraction, c.fraction,
           CASE WHEN f.node_fraction <= c.fraction
                THEN ST_LineSubstring(c.coordinates, f.node_fraction, c.fraction)
                ELSE ST_Reverse(ST_LineSubstring(c.coordinates, c.fraction, f.node_fraction)) END
    FROM pg_temp._route_end_candidates AS c
    CROSS JOIN LATERAL generate_subscripts(c.osm_node_ids, 1) AS g(i)
    CROSS JOIN LATERAL (SELECT ST_LineLocatePoint(c.coordinates, ST_PointN(c.coordinates, g.i)) AS node_fraction) AS f
    ORDER BY c.osm_way_id, g.i;

    -- Same-Way reports can use the direct portion without routing to a vertex.
    INSERT INTO pg_temp._route_edges
        (source, target, cost, street_uuid, osm_way_id, street_name, fraction_from, fraction_to, geom)
    SELECT v_source, v_target,
           a.distance_m + b.distance_m + ST_Length(ST_LineSubstring(a.coordinates,
               LEAST(a.fraction, b.fraction), GREATEST(a.fraction, b.fraction))::GEOGRAPHY),
           a.street_uuid, a.osm_way_id, a.name, a.fraction, b.fraction,
           CASE WHEN a.fraction <= b.fraction
                THEN ST_LineSubstring(a.coordinates, a.fraction, b.fraction)
                ELSE ST_Reverse(ST_LineSubstring(a.coordinates, b.fraction, a.fraction)) END
    FROM pg_temp._route_start_candidates AS a
    JOIN pg_temp._route_end_candidates AS b ON b.street_uuid = a.street_uuid
    ORDER BY a.osm_way_id;

    CREATE INDEX ON pg_temp._route_edges(source);

    CREATE TEMP TABLE _route_nodes (
        node_id BIGINT PRIMARY KEY,
        distance DOUBLE PRECISION,
        previous_edge BIGINT,
        visited BOOLEAN NOT NULL DEFAULT FALSE
    ) ON COMMIT DROP;
    INSERT INTO pg_temp._route_nodes(node_id)
    SELECT node_id FROM (
        SELECT source AS node_id FROM pg_temp._route_edges
        UNION SELECT target FROM pg_temp._route_edges
    ) AS all_nodes;
    CREATE INDEX ON pg_temp._route_nodes(distance) WHERE NOT visited;
    UPDATE pg_temp._route_nodes SET distance = 0 WHERE node_id = v_source;

    -- Dijkstra over this local OSM graph; no extension-specific routing API.
    LOOP
        SELECT node_id INTO v_current
        FROM pg_temp._route_nodes
        WHERE NOT visited AND distance IS NOT NULL
        ORDER BY distance, node_id
        LIMIT 1;
        EXIT WHEN v_current IS NULL;
        EXIT WHEN v_current = v_target;

        UPDATE pg_temp._route_nodes SET visited = TRUE WHERE node_id = v_current;
        UPDATE pg_temp._route_nodes AS n
        SET distance = v.distance + e.cost,
            previous_edge = e.id
        FROM pg_temp._route_edges AS e
        JOIN pg_temp._route_nodes AS v ON v.node_id = v_current
        WHERE e.source = v_current
          AND n.node_id = e.target
          AND NOT n.visited
          AND (n.distance IS NULL OR v.distance + e.cost < n.distance);
        v_current := NULL;
    END LOOP;

    SELECT distance INTO v_total_cost FROM pg_temp._route_nodes WHERE node_id = v_target;
    IF v_total_cost IS NULL THEN
        RAISE LOG 'street route rejected: no connected path; start=(%,%) start_candidates=% end=(%,%) end_candidates=%',
            p_start_lat, p_start_lng, v_start_candidate_count, p_end_lat, p_end_lng, v_end_candidate_count;
        RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'Tidak ditemukan jalur jalan yang terhubung antara titik awal dan titik akhir.';
    END IF;

    CREATE TEMP TABLE _route_path (
        reverse_order BIGSERIAL PRIMARY KEY,
        edge_id BIGINT NOT NULL
    ) ON COMMIT DROP;
    v_current := v_target;
    WHILE v_current <> v_source LOOP
        SELECT previous_edge INTO v_edge_id
        FROM pg_temp._route_nodes WHERE node_id = v_current;
        IF v_edge_id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'Jalur OSM tidak dapat direkonstruksi.';
        END IF;
        INSERT INTO pg_temp._route_path(edge_id) VALUES (v_edge_id);
        SELECT source INTO v_next FROM pg_temp._route_edges WHERE id = v_edge_id;
        v_current := v_next;
        v_step := v_step + 1;
        IF v_step > 10000 THEN
            RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'Jalur OSM melebihi batas rekonstruksi.';
        END IF;
    END LOOP;

    -- Use the endpoint candidate actually chosen by the network path, not
    -- merely the nearest candidate considered during discovery.
    SELECT ST_LineInterpolatePoint(s.coordinates, e.fraction_from), s.distance_m,
           s.osm_way_id, s.name, e.fraction_from
    INTO v_start_snap, v_start_distance, v_start_way_id, v_start_name, v_start_fraction
    FROM pg_temp._route_path AS p
    JOIN pg_temp._route_edges AS e ON e.id = p.edge_id
    JOIN pg_temp._route_start_candidates AS s ON s.street_uuid = e.street_uuid
    WHERE e.source = v_source
    ORDER BY p.reverse_order DESC
    LIMIT 1;

    SELECT ST_LineInterpolatePoint(s.coordinates, e.fraction_to), s.distance_m,
           s.osm_way_id, s.name, e.fraction_to
    INTO v_end_snap, v_end_distance, v_end_way_id, v_end_name, v_end_fraction
    FROM pg_temp._route_path AS p
    JOIN pg_temp._route_edges AS e ON e.id = p.edge_id
    JOIN pg_temp._route_end_candidates AS s ON s.street_uuid = e.street_uuid
    WHERE e.target = v_target
    ORDER BY p.reverse_order
    LIMIT 1;

    CREATE TEMP TABLE _route_ordered ON COMMIT DROP AS
    SELECT row_number() OVER (ORDER BY p.reverse_order DESC)::INTEGER AS step,
           e.street_uuid, e.osm_way_id, e.street_name,
           e.fraction_from, e.fraction_to, e.geom
    FROM pg_temp._route_path AS p
    JOIN pg_temp._route_edges AS e ON e.id = p.edge_id
    WHERE abs(e.fraction_to - e.fraction_from) > 1e-12;

    SELECT COALESCE(sum(ST_Length(geom::GEOGRAPHY)), 0) INTO v_route_length
    FROM pg_temp._route_ordered;
    WITH boundaries AS (
        SELECT o.*,
               CASE WHEN lag(street_uuid) OVER (ORDER BY step) IS DISTINCT FROM street_uuid
                    THEN 1 ELSE 0 END AS new_group
        FROM pg_temp._route_ordered AS o
    ), grouped AS (
        SELECT b.*,
               sum(new_group) OVER (ORDER BY step) AS group_id
        FROM boundaries AS b
    ), route_segments AS (
        SELECT group_id,
               min(step) AS first_step,
               (array_agg(street_uuid ORDER BY step))[1] AS street_uuid,
               (array_agg(osm_way_id ORDER BY step))[1] AS osm_way_id,
               (array_agg(street_name ORDER BY step))[1] AS street_name,
               (array_agg(fraction_from ORDER BY step))[1] AS first_fraction,
               (array_agg(fraction_to ORDER BY step DESC))[1] AS last_fraction,
               ST_MakeLine(geom ORDER BY step) AS geom
        FROM grouped
        GROUP BY group_id
    ), numbered_segments AS (
        SELECT route_segments.*,
               row_number() OVER (ORDER BY first_step) AS segment_order
        FROM route_segments
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'segment_order', segment_order,
        'street_uuid', street_uuid,
        'osm_way_id', osm_way_id,
        'street_name', street_name,
        'start_fraction', LEAST(first_fraction, last_fraction),
        'end_fraction', GREATEST(first_fraction, last_fraction),
        'is_reversed', first_fraction > last_fraction,
        'geometry', ST_AsGeoJSON(geom)::JSONB
    ) ORDER BY first_step), '[]'::JSONB)
    INTO v_segments FROM numbered_segments;
    IF jsonb_array_length(v_segments) = 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'Jalur yang ditemukan tidak memiliki segmen jalan yang dapat disimpan.';
    END IF;
    v_route_signature := md5(
        v_segments::TEXT || ST_AsEWKT(v_start_snap) || ST_AsEWKT(v_end_snap) || v_network_version::TEXT
    );

    RAISE LOG 'street route resolved: start=(%,%) snapped=(%,%) distance_m=% way=% fraction=% candidates=% alternative_distance_m=%; end=(%,%) snapped=(%,%) distance_m=% way=% fraction=% candidates=% alternative_distance_m=%; route_length_m=% segments=% network_version=%',
        p_start_lat, p_start_lng, ST_Y(v_start_snap), ST_X(v_start_snap),
        v_start_distance, v_start_way_id, v_start_fraction, v_start_candidate_count, v_start_alternative_distance,
        p_end_lat, p_end_lng, ST_Y(v_end_snap), ST_X(v_end_snap),
        v_end_distance, v_end_way_id, v_end_fraction, v_end_candidate_count, v_end_alternative_distance,
        v_route_length, jsonb_array_length(v_segments), v_network_version;

    RETURN jsonb_build_object(
        'original_start', ST_AsGeoJSON(v_start)::JSONB,
        'original_end', ST_AsGeoJSON(v_end)::JSONB,
        'snapped_start', ST_AsGeoJSON(v_start_snap)::JSONB,
        'snapped_end', ST_AsGeoJSON(v_end_snap)::JSONB,
        'start_street_name', COALESCE(NULLIF(v_start_name, ''), 'Jalan tanpa nama'),
        'end_street_name', COALESCE(NULLIF(v_end_name, ''), 'Jalan tanpa nama'),
        'start_snap_distance_m', v_start_distance,
        'end_snap_distance_m', v_end_distance,
        'start_candidate_count', v_start_candidate_count,
        'end_candidate_count', v_end_candidate_count,
        'start_near_candidate_count', v_start_near_count,
        'end_near_candidate_count', v_end_near_count,
        'network_version', v_network_version,
        'route_signature', v_route_signature,
        'route_length_m', v_route_length,
        'segments', v_segments
    );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_street_report_route(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_street_report_route(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
