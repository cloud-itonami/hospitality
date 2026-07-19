/**
 * hospitality kotoba — barrel.
 *
 * Per ADR-2605203000 Option B + ADR-0028. Chain / OTA / property actor roster +
 * resource-flow emitter on the etzhayyim substrate (AT PDS records; no RW).
 * Registry-only — booking / catalog / payment live in yadoya / minpaku.
 *
 *   property : registerProperty / getProperty / listProperties
 *   flow     : emitFlow / getFlow / listFlows / coverage
 */

export * from "./types.js";
export { registerProperty, getProperty, listProperties } from "./property.js";
export { emitFlow, getFlow, listFlows, coverage } from "./flow.js";
