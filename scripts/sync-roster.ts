#!/usr/bin/env tsx
// sync-roster.ts — idempotent sync of data/actor-roster.jsonl → PDS → RisingWave.
// ADR-0028 Phase 1. Reverse-toposort order (R1 → R2 → R3 → R4).
// Invoked by: `etzhayyim hospitality sync-roster` (CLI wrapper, TODO in 70-tools/etzhayyim).
//
// Path: hospitality Worker (TS-native) reads roster → PDS commits → firehose →
// graph-writer → RisingWave hummock (vertex_actor_profile_meta / edge_same_as).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// NOTE: host SDK import paths resolve in Worker runtime; here typed loosely for CLI run.
// import type { etzhayyimSdk } from "@etzhayyim/kotodama-host-sdk";
type etzhayyimSdk = {
  did: { create: (path: string, doc: unknown) => Promise<{ did: string }>; list: () => Promise<string[]> };
  pds: { dispatch: (req: unknown) => Promise<unknown> };
};

interface RosterRow {
  tier: "R1" | "R2" | "R3" | "R4";
  region: string;
  did: string;
  isic: string;
  displayName: string;
  description: string;
  avatar?: string;
  banner?: string;
  lei?: string;
  source: string;
}

const TIER_ORDER: RosterRow["tier"][] = ["R1", "R2", "R3", "R4"];

export function loadRoster(): RosterRow[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "data", "actor-roster.jsonl");
  const raw = readFileSync(path, "utf8");
  const rows = raw
    .split("\n")
    .filter((l) => l.trim())
    .map((l, i) => {
      try {
        return JSON.parse(l) as RosterRow;
      } catch (e) {
        throw new Error(`actor-roster.jsonl line ${i + 1} invalid: ${(e as Error).message}`);
      }
    });
  validateRoster(rows);
  return rows;
}

function validateRoster(rows: RosterRow[]): void {
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.did)) throw new Error(`duplicate DID: ${r.did}`);
    seen.add(r.did);
    if (!r.did.startsWith("did:web:hospitality.etzhayyim.com:")) {
      throw new Error(`DID must be under hospitality.etzhayyim.com: ${r.did}`);
    }
    if (!TIER_ORDER.includes(r.tier)) throw new Error(`bad tier: ${r.tier}`);
    if (!r.displayName || !r.description) throw new Error(`missing name/desc: ${r.did}`);
  }
}

function sortReverseTopo(rows: RosterRow[]): RosterRow[] {
  return [...rows].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
}

async function verifyLeiAgainstGleif(lei: string, name: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.gleif.org/api/v1/lei-records/${encodeURIComponent(lei)}`, {
      headers: { Accept: "application/vnd.api+json" },
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { data?: { attributes?: { entity?: { legalName?: { name?: string } } } } };
    const official = body.data?.attributes?.entity?.legalName?.name?.toLowerCase() ?? "";
    const candidate = name.toLowerCase();
    if (!official || !candidate) return false;
    // fuzzy: official name contains candidate first token, or candidate contains official first token
    const officialHead = official.split(/\s+/)[0];
    const candidateHead = candidate.split(/\s+/)[0];
    return official.includes(candidateHead) || candidate.includes(officialHead);
  } catch {
    return false;
  }
}

export async function syncRoster(sdk: etzhayyimSdk, opts: { dryRun?: boolean; verifyLei?: boolean } = {}): Promise<{ registered: number; skipped: number; profiles: number; leiBridges: number }> {
  const rows = sortReverseTopo(loadRoster());
  const existing = new Set(await sdk.did.list());
  let registered = 0;
  let skipped = 0;
  let profiles = 0;
  let leiBridges = 0;

  for (const row of rows) {
    const path = row.did.replace("did:web:hospitality.etzhayyim.com:", "");

    // 1. DID create (idempotent — skip if already registered)
    if (!existing.has(row.did)) {
      if (!opts.dryRun) {
        await sdk.did.create(path, {
          "@context": ["https://www.w3.org/ns/did/v1"],
          id: row.did,
          // alsoKnownAs の LEI bridge は後続 PR (GLEIF verified lookup) で追加。
          // 現 roster の `lei` field は未検証のため DID document に焼き込まない。
        });
      }
      registered++;
    } else {
      skipped++;
    }

    // 2. Profile record — vertex_actor_profile_meta 行を生む
    if (!opts.dryRun) {
      await sdk.pds.dispatch({
        type: "com.atproto.repo.createRecord",
        did: row.did,
        collection: "app.bsky.actor.profile",
        record: {
          displayName: row.displayName,
          description: `${row.description} [AI Agent — unofficial, not affiliated with the real organization]`,
          avatar: row.avatar,
          banner: row.banner,
        },
      });
    }
    profiles++;

    // 3. LEI bridge — edge_same_as 行を生む
    //    CRITICAL: roster の `lei` field は training-data 由来で未検証。
    //    GLEIF API (api.gleif.org) で live validation 成功した行のみ書き込む。
    //    未検証フィールドは skip (後続 `gleif-backfill.ts` PR で処理)。
    if (row.lei && opts.verifyLei && !opts.dryRun) {
      const verified = await verifyLeiAgainstGleif(row.lei, row.displayName);
      if (!verified) continue;
      await sdk.pds.dispatch({
        type: "com.atproto.repo.createRecord",
        did: row.did,
        collection: "com.etzhayyim.apps.hospitality.leiBridge",
        record: {
          actorDid: row.did,
          lei: row.lei,
          legalEntityDid: `did:web:legal-entity.etzhayyim.com:lei:${row.lei}`,
          industryCode: row.isic,
          region: row.region,
          source: row.source,
        },
      });
      leiBridges++;
    }
  }

  return { registered, skipped, profiles, leiBridges };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = loadRoster();
  const byTier = rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.tier]: (a[r.tier] ?? 0) + 1 }), {});
  const byRegion = rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.region]: (a[r.region] ?? 0) + 1 }), {});
  const lei = rows.filter((r) => r.lei).length;
  console.log(JSON.stringify({ total: rows.length, tier: byTier, region: byRegion, lei_attached: lei }, null, 2));
}
