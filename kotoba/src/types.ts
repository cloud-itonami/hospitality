/**
 * hospitality kotoba — record types.
 *
 * Per ADR-2605203000 Option B + ADR-0028. hospitality is the chain / OTA /
 * property umbrella: it holds a property-actor roster and emits resource-flow
 * records (revenue / room-nights / headcount / occupancy). It does NOT own
 * booking / catalog / payment — those live in yadoya / minpaku. So this is a
 * pure registry (no on-chain settlement). ADR-2605172000 kotoba.
 *
 * Identity hierarchy:
 *   did:web:hospitality.etzhayyim.com                          — controller
 *   did:web:hospitality.etzhayyim.com:property:{propertyId}    — a property actor
 *   did:web:hospitality.etzhayyim.com:flow:{flowId}            — a flow record
 */

export const HOSPITALITY_DID_PREFIX = "did:web:hospitality.etzhayyim.com:" as const;

export const PROPERTY_COLLECTION = "com.etzhayyim.apps.hospitality.property";
export const FLOW_COLLECTION = "com.etzhayyim.apps.hospitality.flow";

/** Roster tiers: a chain owns OTAs/properties; an OTA aggregates properties. */
export type PropertyKind = "chain" | "ota" | "property";

export interface PropertyRecord {
  did: string;
  propertyId: string;
  kind: PropertyKind;
  name: string;
  /** Parent roster id (property → ota/chain), if any. */
  parentId?: string;
  location?: string;
  roomCount?: number;
  active: boolean;
  createdAt: string;
}

export interface PropertyView extends PropertyRecord {
  propertyUri: string;
}

export interface RegisterPropertyInput {
  propertyId: string;
  kind: PropertyKind;
  name: string;
  parentId?: string;
  location?: string;
  roomCount?: number;
  active?: boolean;
}

export interface RegisterPropertyOutput {
  status: "registered" | "alreadyExists" | "rejected";
  propertyUri?: string;
  did?: string;
  propertyId?: string;
  error?: string;
}

export interface GetPropertyInput {
  propertyId: string;
}

export interface GetPropertyOutput {
  property?: PropertyView;
  error?: string;
}

export interface ListPropertiesInput {
  kind?: PropertyKind;
  parentId?: string;
  activeOnly?: boolean;
  limit?: number;
  cursor?: string;
}

export interface ListPropertiesOutput {
  items: PropertyView[];
  cursor?: string;
  total: number;
}

// ─── Resource-flow (ADR-0028) ───────────────────────────────────────

/**
 * Flow metrics. Monetary values are USDC micros; counts are integers; both as
 * decimal STRINGS (AT Lexicon has no float; large micros exceed safe Number).
 */
export type FlowMetric = "revenue" | "roomNights" | "headcount" | "occupancyPermille";

export interface FlowRecord {
  did: string;
  flowId: string;
  propertyId: string;
  metric: FlowMetric;
  /** YYYY-MM accounting period. */
  period: string;
  /** Integer value as a string: USDC micros (revenue) or count / permille. */
  value: string;
  createdAt: string;
}

export interface FlowView extends FlowRecord {
  flowUri: string;
}

export interface EmitFlowInput {
  propertyId: string;
  metric: FlowMetric;
  period: string;
  value: string;
}

export interface EmitFlowOutput {
  status: "emitted" | "alreadyExists" | "rejected" | "propertyNotFound";
  flowUri?: string;
  did?: string;
  flowId?: string;
  error?: string;
}

export interface GetFlowInput {
  propertyId: string;
  metric: FlowMetric;
  period: string;
}

export interface GetFlowOutput {
  flow?: FlowView;
  error?: string;
}

export interface ListFlowsInput {
  propertyId?: string;
  metric?: FlowMetric;
  period?: string;
  limit?: number;
  cursor?: string;
}

export interface ListFlowsOutput {
  items: FlowView[];
  cursor?: string;
  total: number;
}

export interface CoverageInput {
  maxScan?: number;
}

export interface CoverageOutput {
  propertyCount?: number;
  propertiesByKind?: Record<string, number>;
  flowCount?: number;
  flowsByMetric?: Record<string, number>;
  truncated?: boolean;
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

const RE_PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidPeriod(p: string): boolean {
  return RE_PERIOD.test(p);
}

export function isIntString(s: string): boolean {
  return /^\d+$/.test(s);
}

export function propertyDid(propertyId: string): string {
  return `${HOSPITALITY_DID_PREFIX}property:${propertyId.toLowerCase()}`;
}

export function propertyRkey(propertyId: string): string {
  return `property-${propertyId.toLowerCase()}`;
}

/** A flow is unique per (property, metric, period). */
export function flowId(propertyId: string, metric: FlowMetric, period: string): string {
  return `${propertyId.toLowerCase()}-${metric}-${period}`;
}

export function flowDid(id: string): string {
  return `${HOSPITALITY_DID_PREFIX}flow:${id}`;
}

export function flowRkey(id: string): string {
  return `flow-${id}`;
}
