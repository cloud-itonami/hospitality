# Operator quickstart

Every command below was executed against this repository at commit `c642d1e`
before it was written down, and the outputs are the real ones. Exit codes were
read from a file rather than through a pipe — `cmd | tail; echo $?` reports the
exit status of `tail`, not of `cmd`.

Verified on macOS 25.3.0, Node **v26.7.0**, npm 11.19.0.

**What this gets you:** the roster read and integrity-checked, and the `kotoba/`
library suite green. **What it does not get you:** anything live. No step here
writes to a PDS, a DID registry or RisingWave; `@etzhayyim/sdk-mock` stands in
for the PDS. Steps 1–3 need no network at all. Step 4 does — `npm install`
clones eight git dependencies — but the tests themselves stay local. See
[Not covered here](#not-covered-here).

## 0. Prerequisites

Node only. The two roster scripts are TypeScript executed by Node's built-in
type stripping, so no transpiler and no `node_modules` are involved:

```bash
node --version   # v26.7.0 when this was written
```

`scripts/sync-roster.test-fixture.ts` used to document itself as
`pnpm tsx scripts/sync-roster.test-fixture.ts`. That cannot work — there is no
`package.json` at the repository root, so pnpm exits
`ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND`. Use `node`.

## 1. Read the roster — no install

```bash
node scripts/sync-roster.ts
```

Exit `0`, and the roster summarises itself:

```json
{
  "total": 564,
  "tier": { "R1": 198, "R2": 59, "R3": 287, "R4": 20 },
  "region": { "global": 28, "europe": 69, "mena": 37, "apac": 86, "latam": 46,
              "africa": 85, "us": 18, "jp": 36, "cis": 7, "cee": 16,
              "south-asia": 12, "oceania": 38, "caribbean": 47,
              "central-asia": 11, "nordic": 12, "baltic": 6,
              "indian-ocean": 9, "asia": 1 },
  "lei_attached": 0
}
```

`lei_attached: 0` is correct, not a loading failure. `sync-roster.ts` treats the
`lei` field as training-data provenance and refuses to write one into a DID
document unless GLEIF confirms it live; no row currently carries one.

Tiers are the reverse-topological rollout order — associations first (they are
the authority and benchmark), properties last:
R1 `assoc` 198 · R2 `ota` 59 · R3 `chain` 281 + `cruise` 6 · R4 `property` 20.

## 2. Validate the roster — no install

```bash
node scripts/sync-roster.test-fixture.ts
```

Exit `0`, printing `"ok": true` and the same counts. It is stronger than step 1
in exactly one way — it also checks **LEI format**, which `loadRoster` does not.
Its duplicate-DID check repeats one `loadRoster` has already run.

Its third check, reverse-topological ordering, **cannot fail**, and you should
not count it. The loop sorts the rows by tier and then asserts the sorted copy
is ordered:

```js
for (const r of [...rows].sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier))) {
  const i = order.indexOf(r.tier);
  if (i < prev) throw new Error(`reverse-topo violation ...`);
  prev = i;
}
```

A sorted array is non-decreasing, so the `throw` is unreachable. Measured: the
roster was rewritten R4-first / R1-last — the worst possible order — and the
fixture still exited `0` with `"ok": true`. Reordering the file cannot make it
red, which is consistent with the file itself: as committed it has **15**
tier-order violations, because `syncRoster` calls `sortReverseTopo` before
processing and file order is genuinely not the contract.

This is left as found. Deciding what the check *should* assert — file order,
or that `sortReverseTopo` still sorts — is a change to the test, not to the
documentation, and belongs to whoever owns the roster contract.

## 3. Prove step 2 can fail

A validator you have only ever seen succeed is not evidence of anything. Each
mutation below was applied to a throwaway copy, run, and reverted. All five exit
`1` with a message that names the specific fault:

| Break | Reported as |
|---|---|
| Append a duplicate of line 1 | `Error: duplicate DID: did:web:hospitality.etzhayyim.com:actor:assoc:unwto` |
| Repoint a DID at `did:web:evil.example.com:…` | `Error: DID must be under hospitality.etzhayyim.com: …` |
| Set a row's `lei` to `NOT-A-VALID-LEI` | `Error: bad LEI format on …: NOT-A-VALID-LEI` |
| Append a truncated JSON line | `Error: actor-roster.jsonl line 565 invalid: Expected ',' or '}' …` |
| Set a row's `tier` to `R9` | `Error: bad tier: R9` |

```bash
cp -R . /tmp/roster-mutation && cd /tmp/roster-mutation
head -1 data/actor-roster.jsonl >> data/actor-roster.jsonl
node scripts/sync-roster.test-fixture.ts > /tmp/m.out 2>&1; echo "exit=$?"   # exit=1
```

The third row is the reason to run the fixture rather than the CLI: on the bad
LEI, `node scripts/sync-roster.ts` exits **`0`** and cheerfully reports
`"lei_attached": 1`. The two commands are not interchangeable.

## 4. Run the `kotoba/` suite

This one needs dependencies. `kotoba/` is the only npm project in the
repository — there is no `package.json` at the root.

```bash
cd kotoba
npm install        # ~12 min here. Eight @etzhayyim git deps — two declared
                   # (sdk, sdk-mock) and six pulled in behind them — each cloned
                   # and `tsc`-prepared. Not hung: watch node_modules/@etzhayyim/ fill.
npm run typecheck  # exit 0
npm test           # exit 0
```

```
 Test Files  1 passed (1)
      Tests  10 passed (10)
   Duration  322ms
```

Ten tests over two families: two helper tests (`YYYY-MM` period validation,
`flowId` uniqueness), three roster tests (parented registration, idempotency
plus bad-`kind` rejection, listing by parent), and five flow tests (emit and
read back, refuse an unrostered property, refuse a bad metric/period/value,
idempotency per `(property, metric, period)`, and `coverage` aggregation).
`@etzhayyim/sdk-mock` stands in for the PDS, so nothing leaves the machine.

`npm install` also writes a `kotoba/package-lock.json`. This repository does not
commit one, so it will show up untracked; `.gitignore` deliberately does not
hide it, because whether to pin the eight git dependencies by SHA is a policy
call for whoever owns the repo, not something a quickstart should decide.

### Prove the suite can fail

Same reasoning as step 3. Each of these was applied to `kotoba/src`, run, and
reverted with `git checkout --`; after all three reverts `npm test` was green
again at 10/10:

| Break | Test that goes red |
|---|---|
| Disable the roster guard in `emitFlow` | `rejects flow for a non-rostered property` |
| Drop `period` from the `flowId` key in `types.ts` | `flowId is unique per property/metric/period` |
| Disable the `METRICS` membership check | `rejects invalid metric / period / value` |

Each mutation failed exactly one test — the one naming the invariant it broke —
and left the other nine passing.

## Troubleshooting

**`npm error code EALLOWSCRIPTS` during `npm install`.**

```
--allow-scripts is not allowed in project-scoped installs.
Add the entries to the "allowScripts" field in package.json, or to .npmrc, instead.
```

Not a fault in this repository. npm prepares a git dependency by spawning a
nested `npm install --force …` inside it, and that nested install is
project-scoped — so any `allow-scripts[]` entry in your **user-level**
`~/.npmrc` makes it refuse. This happened on the machine these notes were
written on. Run the install with a user config that omits those lines:

```bash
grep -v '^allow-scripts' ~/.npmrc > /tmp/npmrc-clean
npm_config_userconfig=/tmp/npmrc-clean npm install
```

Every `npm` command in step 4 was run that way here.

**`npm install` looks frozen.** It is not. `node_modules/@etzhayyim/` fills one
package at a time; `sdk` is populated last.

## Not covered here

Nothing below was exercised, so nothing below is documented as if it were:

- **Live roster sync.** `syncRoster()` writes DID documents, PDS profile records
  and GLEIF-verified LEI bridges. Only `loadRoster()` — its read-and-validate
  half — runs above. There is no CLI flag for the dry run; the fixture in step 2
  is what exercises that path.
- **`scripts/direct-insert-fallback.sql`.** The RisingWave DR path. It needs
  migrations 0057/0060/0061 applied and a `RISINGWAVE_HYPERDRIVE_DSN`.
- **Deployment.** There is no Worker, no `wrangler.toml`, and no deploy step in
  this repository.
- **`data/ownership-edges.jsonl`.** No code reads it, so no step here validates
  it. At this commit all 47 edges carry a `sourceUrl` and a `sourceLicense` and
  both endpoints of each resolve to a roster DID — measured directly, not
  checked by anything that would go red if it stopped being true.
