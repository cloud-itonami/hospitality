// sync-roster.test-fixture.ts — minimal dry-run verification harness.
// Run: `node scripts/sync-roster.test-fixture.ts` (from the repository root).
// Needs no install: Node strips the types. There is no package.json at the root,
// so the previously documented `pnpm tsx ...` cannot resolve here.
// Does NOT touch PDS. Validates roster shape, duplicate DIDs and LEI format.
// (Its reverse-topo check is vacuous — see the NOTE below.)

import { loadRoster } from "./sync-roster.ts";

const rows = loadRoster();

// NOTE: this check cannot fail. It sorts by tier and then asserts the sorted
// copy is non-decreasing, so the throw below is unreachable — verified by
// rewriting the roster R4-first, which still exits 0. Left as found: the file
// as committed has 15 tier-order violations and syncRoster sorts before use,
// so file order is not the contract either. Fixing this means first deciding
// what the invariant is. See docs/operator-quickstart.md step 2.
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
