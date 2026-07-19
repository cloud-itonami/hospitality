-- direct-insert-fallback.sql (revised 2026-04-15 iter 18)
-- ADR-0028 Phase 1 fallback: write hospitality roster directly into RisingWave hummock,
-- bypassing the normal PDS → firehose → graph-writer path.
--
-- Use only when (a) PDS / firehose unavailable, (b) DR drill, (c) bootstrap with no PDS auth.
--
-- Pre-flight (CRITICAL — do NOT skip):
--   1. Migrations 0057, 0060, 0061 must be applied first.
--      DATABASE_URL=$RISINGWAVE_HYPERDRIVE_DSN pnpm db:migrate
--   2. Roster CSV materialised from data/actor-roster.jsonl. Generation:
--        python3 -c "
--        import json,csv,sys
--        rows=[json.loads(l) for l in open('data/actor-roster.jsonl') if l.strip()]
--        w=csv.writer(sys.stdout)
--        w.writerow(['tier','region','did','isic','display_name','description','avatar','banner','lei','source'])
--        for r in rows: w.writerow([r['tier'],r['region'],r['did'],r['isic'],r['displayName'],
--                                   r['description'],r.get('avatar',''),r.get('banner',''),
--                                   r.get('lei',''),r['source']])
--        " > /tmp/hospitality-roster.csv
--   3. Confirm RisingWave PostgreSQL FE 接続 (port 4566 default).
--
-- Schema targets (verified against migrations 0006, 0037):
--   vertex_actor_profile_meta — display_name / description / avatar_cid / banner_cid
--   edge_owned_by             — populated from data/ownership-edges.jsonl in a separate step
--                               (NOT in this script — needs CSV second pass)
--
-- LEI bridge (edge_same_as) is INTENTIONALLY DROPPED from this fallback:
--   - edge_same_as table not yet defined in the schema (would need a new migration)
--   - 14 LEI values in roster are training-data heuristics, not GLEIF-verified
--   - Future PR: GLEIF API verification + edge_same_as migration + bridge insert
--
-- Usage:
--   psql $RISINGWAVE_HYPERDRIVE_DSN -v ON_ERROR_STOP=1 \
--     -v rostersrc=/tmp/hospitality-roster.csv \
--     -f scripts/direct-insert-fallback.sql
--
-- Idempotency: WHERE NOT EXISTS skips rows already present (RisingWave does not
--              support ON CONFLICT DO NOTHING on non-exempt tables).

\set ROSTER_CSV :rostersrc

BEGIN;

CREATE TEMP TABLE _roster_csv (
  tier         varchar,
  region       varchar,
  did          varchar,
  isic         varchar,
  display_name varchar,
  description  text,
  avatar       varchar,
  banner       varchar,
  lei          varchar,
  source       varchar
) ON COMMIT DROP;

\copy _roster_csv FROM :'ROSTER_CSV' WITH (FORMAT csv, HEADER true);

-- Sanity: roster row count must match data/actor-roster.jsonl wc -l.
SELECT 'roster_rows' AS metric, COUNT(*) AS value FROM _roster_csv;

INSERT INTO vertex_actor_profile_meta
  (vertex_id, _seq, created_date, sensitivity_ord, owner_did, actor_did,
   display_name, description, avatar_cid, banner_cid)
SELECT
  r.did                               AS vertex_id,
  extract(epoch from now())::bigint   AS _seq,
  current_date                        AS created_date,
  0                                   AS sensitivity_ord,
  'did:web:hospitality.etzhayyim.com'       AS owner_did,
  r.did                               AS actor_did,
  r.display_name                      AS display_name,
  r.description ||
    ' [AI Agent — unofficial, not affiliated with the real organization]'
                                      AS description,
  NULLIF(r.avatar, '')                AS avatar_cid,
  NULLIF(r.banner, '')                AS banner_cid
FROM _roster_csv r
WHERE NOT EXISTS (
  SELECT 1 FROM vertex_actor_profile_meta WHERE vertex_id = r.did
);

COMMIT;

-- Verify (streaming MVs may take a few seconds to converge):
SELECT 'profile_count' AS metric, COUNT(*) AS value
FROM vertex_actor_profile_meta
WHERE vertex_id LIKE 'did:web:hospitality.etzhayyim.com:actor:%';

SELECT kind, actor_cnt FROM mv_hospitality_actor_coverage ORDER BY actor_cnt DESC;
SELECT tier, kind, actor_cnt FROM mv_hospitality_tier_coverage ORDER BY tier, actor_cnt DESC;
