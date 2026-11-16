SELECT
    pg_get_function_result(
        'public.get_home_road_segments()'::regprocedure
    ) AS rpc_result;



-- Mengecek nama kolom geometri RPC yang aktif
-- Hanya membaca, tidak mengubah database

SELECT
    pg_get_function_result(
        'public.get_home_road_segments()'::regprocedure
    ) LIKE '%road_geojson%' AS ada_road_geojson,

    pg_get_function_result(
        'public.get_home_road_segments()'::regprocedure
    ) LIKE '%marker_geojson%' AS ada_marker_geojson,

    pg_get_function_result(
        'public.get_home_road_segments()'::regprocedure
    ) LIKE '%roadPath%' AS ada_roadPath;




-- Melihat kode fungsi import_osm_streets
-- Aman: tidak mengubah database

SELECT
    p.oid::regprocedure AS nama_fungsi,
    pg_get_functiondef(p.oid) AS kode_sql
FROM pg_proc p
JOIN pg_namespace n
    ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'import_osm_streets';



SELECT pg_get_functiondef(
    'public.import_osm_streets(jsonb)'::regprocedure
) AS kode_sql;


-- Melihat migration yang sudah tercatat
-- Hanya membaca, tidak mengubah database

SELECT version
FROM supabase_migrations.schema_migrations
ORDER BY version;



-- Mengecek siapa yang boleh menjalankan fungsi impor OSM
-- Hanya membaca, tidak mengubah database

SELECT
    has_function_privilege(
        'anon',
        'public.import_osm_streets(jsonb)',
        'EXECUTE'
    ) AS akses_anon,

    has_function_privilege(
        'authenticated',
        'public.import_osm_streets(jsonb)',
        'EXECUTE'
    ) AS akses_authenticated,

    has_function_privilege(
        'service_role',
        'public.import_osm_streets(jsonb)',
        'EXECUTE'
    ) AS akses_service_role;
