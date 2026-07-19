// sync-roster.test-fixture.ts — minimal dry-run verification harness.
// Run: `pnpm tsx scripts/sync-roster.test-fixture.ts`
// Does NOT touch PDS. Validates roster shape + reverse-topo ordering only.

import { loadRoster } from "./sync-roster.ts";

const rows = loadRoster();

const order = ["R1", "R2", "R3", "R4"] as const;
let prev = 0;
for (const r of [...rows].sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier))) {
  const i = order.indexOf(r.tier);
  if (i < prev) throw new Error(`reverse-topo violation at ${r.did}: ${r.tier} after tier index ${prev}`);
  prev = i;
}

const dids = rows.map((r) => r.did);
const dupes = dids.filter((d, i) => dids.indexOf(d) !== i);
if (dupes.length) throw new Error(`duplicate DIDs: ${dupes.join(", ")}`);

for (const r of rows) {
  if (r.lei && !/^[A-Z0-9]{20}$/.test(r.lei)) {
    throw new Error(`bad LEI format on ${r.did}: ${r.lei}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  total: rows.length,
  tier: rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.tier]: (a[r.tier] ?? 0) + 1 }), {}),
  region: rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.region]: (a[r.region] ?? 0) + 1 }), {}),
  lei_attached: rows.filter((r) => r.lei).length,
}, null, 2));
