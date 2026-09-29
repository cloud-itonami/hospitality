# hospitality — hotel / OTA / property actor roster and resource-flow emitter

`hospitality` holds the roster of hotel-chain, OTA, industry-association and
individual-property actors for `hospitality.etzhayyim.com`, and emits
resource-flow records (revenue, room-nights, headcount, occupancy) about them.
Its canonical repository is `cloud-itonami/hospitality`.

The name does not say what the repo does, so: this is a **registry and an
emitter, not a booking system**. Nothing here takes a reservation, holds a
catalogue, or moves money.

## What it does not own

| Concern | Lives in |
|---|---|
| Booking engine, reservation lifecycle, B2C/B2B UI | `yadoya.etzhayyim.com` |
| OSM Overpass + 観光庁 open-data collection | `minpaku.etzhayyim.com` |
| Sankey / lineage / comparison views over the emitted flows | `resource-flow.etzhayyim.com` |
| Legal-entity vertices that actors bridge to | `legal-entity.etzhayyim.com` |

Actors are **promoted** from the yadoya catalogue and the minpaku OSM set; this
repo does not collect them itself. Keeping that boundary is the point of the
split — see `AGENTS.md` for the full responsibility table.

## What is actually in here

```
data/actor-roster.jsonl        564 actors — R1 assoc 198 / R2 OTA 59 / R3 chain 281 + cruise 6 / R4 property 20
data/ownership-edges.jsonl      47 parent→child links, each with sourceUrl + sourceLicense
kotoba/                        TypeScript reference implementation on @etzhayyim/sdk
scripts/sync-roster.ts         roster → DID → PDS profile → LEI bridge, idempotent, R1→R4 order
scripts/direct-insert-fallback.sql  DR path: roster straight into RisingWave, bypassing PDS
```

The roster is the source of truth. It is spread over 18 regions and carries no
LEI values yet (`lei_attached: 0`) — `sync-roster.ts` deliberately refuses to
burn an unverified LEI into a DID document, and only writes a bridge for rows
that GLEIF confirms live.

`kotoba/` implements two record families against the AT PDS, with no RisingWave
and no settlement:

- **property roster** — `registerProperty` / `getProperty` / `listProperties`,
  keyed on a stable rkey so re-registration reports `alreadyExists`.
- **resource flow** — `emitFlow` / `getFlow` / `listFlows` / `coverage`. A flow
  is unique per `(property, metric, period)`. Emission for a property that is
  not on the roster is refused with `propertyNotFound`, so a flow can never
  describe an actor nobody registered. Values are decimal **strings** — AT
  Lexicon has no float, and revenue in USDC micros exceeds a safe `Number`.

## Running it

See **[`docs/operator-quickstart.md`](docs/operator-quickstart.md)**. The two
roster checks need no install at all:

```bash
node scripts/sync-roster.ts              # roster statistics
node scripts/sync-roster.test-fixture.ts # validate shape, DIDs, tiers, LEI format
```

The `kotoba/` suite needs its dependencies: `cd kotoba && npm install && npm test`.

## Status

`PROJECT.jsonld` calls this a **Scaffold**, and that is accurate: phase 0 (ADR,
lexicon, roster) is done; phases 1–4 — DID registration, the IR/EDGAR/EDINET
collector, the resource-flow `onCommit` handler and the remaining lexicons — are
all marked pending. Accordingly the operator quickstart exercises only
`loadRoster()`, the read-and-validate half of `sync-roster.ts`; the half that
writes DID documents and PDS records is not run there.

Three gaps worth knowing before you rely on something here:

- **One of the roster's three integrity checks cannot fail.** The reverse-
  topological ordering check in `scripts/sync-roster.test-fixture.ts` sorts the
  rows and then asserts the sorted copy is ordered, so its `throw` is
  unreachable. Measured: a roster rewritten R4-first still passes `"ok": true`.
  The other checks are real — see the quickstart, which breaks each of them.
- **`data/ownership-edges.jsonl` is not validated by anything.** No code in this
  repository reads it; only a comment in `direct-insert-fallback.sql` says it is
  "populated in a separate step". The roster has five checks the quickstart
  demonstrates going red; the edges have none. They are in fact clean at this
  commit — all 47 carry a `sourceUrl` and a `sourceLicense`, and both endpoints
  of every edge resolve to a roster DID — but nothing would go red if that
  stopped being true.
- **`NOTICE` points at `CHARTER-RIDER.md`, which is not in this repository.**
  Fleet-wide rather than a local slip: measured 2026-09-01, 186 `cloud-itonami`
  repositories cite that file in their `NOTICE` and all 186 are missing it.

## Identity

| Field | Value |
|---|---|
| Domain | `hospitality.etzhayyim.com` |
| Controller DID | `did:web:hospitality.etzhayyim.com` |
| Property actor | `did:web:hospitality.etzhayyim.com:property:{propertyId}` |
| Flow record | `did:web:hospitality.etzhayyim.com:flow:{flowId}` |
| Authoritative ADR | ADR-0028 (resource-flow private-sector extension) |
| PII posture | ADR-0018 tier 3 — cohort ≥ 5, individual DIDs forbidden |

Machine-readable repository metadata is in `README.edn`; the extraction record
from `etzhayyim/root` is in `migration.edn`. Both still carry the pre-move name
`com-etzhayyim-app-hospitality` and name `etzhayyim` as the destination org —
the git remote is `cloud-itonami/hospitality`, so those two fields are historical
rather than current. Apache-2.0 with the etzhayyim Charter Compliance Rider —
see `NOTICE`.
