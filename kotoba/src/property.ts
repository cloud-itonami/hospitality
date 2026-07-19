/**
 * hospitality kotoba — property-actor roster. AT PDS records (no RW).
 * registerProperty / getProperty / listProperties.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  PROPERTY_COLLECTION,
  propertyDid,
  propertyRkey,
  type GetPropertyInput,
  type GetPropertyOutput,
  type ListPropertiesInput,
  type ListPropertiesOutput,
  type PropertyKind,
  type PropertyRecord,
  type PropertyView,
  type RegisterPropertyInput,
  type RegisterPropertyOutput,
} from "./types.js";

const KINDS: ReadonlySet<PropertyKind> = new Set(["chain", "ota", "property"]);

export async function registerProperty(
  e: Etzhayyim,
  input: RegisterPropertyInput
): Promise<RegisterPropertyOutput> {
  if (!input.propertyId || !input.name || !input.kind) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  if (!KINDS.has(input.kind)) {
    return { status: "rejected", error: "invalidKind" };
  }

  const rkey = propertyRkey(input.propertyId);
  const existing = await e
    .read<PropertyRecord>({ collection: PROPERTY_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      propertyUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      propertyId: input.propertyId,
    };
  }

  const did = propertyDid(input.propertyId);
  const record: PropertyRecord = {
    did,
    propertyId: input.propertyId,
    kind: input.kind,
    name: input.name,
    parentId: input.parentId ? input.parentId.toLowerCase() : undefined,
    location: input.location,
    roomCount: input.roomCount,
    active: input.active ?? true,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: PROPERTY_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return { status: "registered", propertyUri: receipt.uri, did, propertyId: input.propertyId };
}

export async function getProperty(
  e: Etzhayyim,
  input: GetPropertyInput
): Promise<GetPropertyOutput> {
  if (!input.propertyId) return { error: "invalidPropertyId" };
  const resp = await e
    .read<PropertyRecord>({ collection: PROPERTY_COLLECTION, rkey: propertyRkey(input.propertyId) })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  return { property: { ...r.value, propertyUri: r.uri } };
}

export async function listProperties(
  e: Etzhayyim,
  input: ListPropertiesInput = {}
): Promise<ListPropertiesOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<PropertyRecord>({
    collection: PROPERTY_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: PropertyView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.kind && v.kind !== input.kind) return false;
      if (input.parentId && v.parentId !== input.parentId.toLowerCase()) return false;
      if (input.activeOnly && v.active !== true) return false;
      return true;
    })
    .map((r) => ({ ...r.value, propertyUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}
