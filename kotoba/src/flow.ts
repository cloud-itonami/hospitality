/**
 * hospitality kotoba — resource-flow emitter (ADR-0028). AT PDS records (no RW).
 * emitFlow / getFlow / listFlows + coverage. A flow is unique per
 * (property, metric, period); re-emit is idempotent (overwrite via stable rkey).
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  FLOW_COLLECTION,
  PROPERTY_COLLECTION,
  flowDid,
  flowId,
  flowRkey,
  isIntString,
  isValidPeriod,
  propertyRkey,
  type CoverageInput,
  type CoverageOutput,
  type EmitFlowInput,
  type EmitFlowOutput,
  type FlowMetric,
  type FlowRecord,
  type FlowView,
  type GetFlowInput,
  type GetFlowOutput,
  type ListFlowsInput,
  type ListFlowsOutput,
  type PropertyKind,
  type PropertyRecord,
} from "./types.js";

const METRICS: ReadonlySet<FlowMetric> = new Set([
  "revenue",
  "roomNights",
  "headcount",
  "occupancyPermille",
]);

const PAGE_LIMIT = 100;
const DEFAULT_MAX_SCAN = 10_000;

export async function emitFlow(
  e: Etzhayyim,
  input: EmitFlowInput
): Promise<EmitFlowOutput> {
  if (!input.propertyId || !input.metric || !input.period || input.value === undefined) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  if (!METRICS.has(input.metric)) return { status: "rejected", error: "invalidMetric" };
  if (!isValidPeriod(input.period)) return { status: "rejected", error: "invalidPeriod" };
  if (!isIntString(input.value)) return { status: "rejected", error: "valueMustBeIntString" };

  // Property must be on the roster.
  const prop = await e
    .read<PropertyRecord>({
      collection: PROPERTY_COLLECTION,
      rkey: propertyRkey(input.propertyId),
    })
    .catch(() => ({ records: [] }));
  if (!prop.records[0]?.value) {
    return { status: "propertyNotFound", error: "propertyNotFound" };
  }

  const id = flowId(input.propertyId, input.metric, input.period);
  const rkey = flowRkey(id);
  const existing = await e
    .read<FlowRecord>({ collection: FLOW_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      flowUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      flowId: id,
    };
  }

  const did = flowDid(id);
  const record: FlowRecord = {
    did,
    flowId: id,
    propertyId: input.propertyId.toLowerCase(),
    metric: input.metric,
    period: input.period,
    value: input.value,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: FLOW_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return { status: "emitted", flowUri: receipt.uri, did, flowId: id };
}

export async function getFlow(
  e: Etzhayyim,
  input: GetFlowInput
): Promise<GetFlowOutput> {
  if (!input.propertyId || !input.metric || !input.period) {
    return { error: "missingKey" };
  }
  const id = flowId(input.propertyId, input.metric, input.period);
  const resp = await e
    .read<FlowRecord>({ collection: FLOW_COLLECTION, rkey: flowRkey(id) })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  return { flow: { ...r.value, flowUri: r.uri } };
}

export async function listFlows(
  e: Etzhayyim,
  input: ListFlowsInput = {}
): Promise<ListFlowsOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<FlowRecord>({
    collection: FLOW_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: FlowView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.propertyId && v.propertyId !== input.propertyId.toLowerCase()) return false;
      if (input.metric && v.metric !== input.metric) return false;
      if (input.period && v.period !== input.period) return false;
      return true;
    })
    .map((r) => ({ ...r.value, flowUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

export async function coverage(
  e: Etzhayyim,
  input: CoverageInput = {}
): Promise<CoverageOutput> {
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);

  const propertiesByKind: Record<string, number> = {};
  let propertyCount = 0;
  let cursor: string | undefined;
  let scanned = 0;
  while (scanned < maxScan) {
    const page = await e.read<PropertyRecord>({
      collection: PROPERTY_COLLECTION,
      cursor,
      limit: PAGE_LIMIT,
    });
    for (const r of page.records) {
      if (scanned >= maxScan) break;
      propertiesByKind[r.value.kind as PropertyKind] =
        (propertiesByKind[r.value.kind as PropertyKind] ?? 0) + 1;
      propertyCount += 1;
      scanned += 1;
    }
    if (scanned >= maxScan || !page.cursor || page.records.length < PAGE_LIMIT) break;
    cursor = page.cursor;
  }

  const flowsByMetric: Record<string, number> = {};
  let flowCount = 0;
  let flowCursor: string | undefined;
  let fscanned = 0;
  while (fscanned < maxScan) {
    const fpage = await e.read<FlowRecord>({
      collection: FLOW_COLLECTION,
      cursor: flowCursor,
      limit: PAGE_LIMIT,
    });
    for (const r of fpage.records) {
      if (fscanned >= maxScan) break;
      flowsByMetric[r.value.metric as FlowMetric] =
        (flowsByMetric[r.value.metric as FlowMetric] ?? 0) + 1;
      flowCount += 1;
      fscanned += 1;
    }
    if (fscanned >= maxScan || !fpage.cursor || fpage.records.length < PAGE_LIMIT) break;
    flowCursor = fpage.cursor;
  }

  return {
    propertyCount,
    propertiesByKind,
    flowCount,
    flowsByMetric,
    truncated: scanned >= maxScan || fscanned >= maxScan,
  };
}
