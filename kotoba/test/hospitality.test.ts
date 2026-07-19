import { describe, it, expect, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import {
  registerProperty,
  getProperty,
  listProperties,
  emitFlow,
  getFlow,
  listFlows,
  coverage,
  isValidPeriod,
  flowId,
} from "../src/index.js";

describe("hospitality kotoba", () => {
  let e: any;
  beforeEach(() => {
    e = new MockEtzhayyim({ did: "did:web:hospitality.etzhayyim.com" });
  });

  describe("helpers", () => {
    it("validates YYYY-MM period", () => {
      expect(isValidPeriod("2026-07")).toBe(true);
      expect(isValidPeriod("2026-13")).toBe(false);
      expect(isValidPeriod("2026-7")).toBe(false);
    });
    it("flowId is unique per property/metric/period", () => {
      expect(flowId("Hotel-A", "revenue", "2026-07")).toBe("hotel-a-revenue-2026-07");
    });
  });

  describe("property roster", () => {
    it("registers chain + property with parent", async () => {
      expect((await registerProperty(e, { propertyId: "CH-1", kind: "chain", name: "Acme Hotels" })).status).toBe("registered");
      const p = await registerProperty(e, {
        propertyId: "P-1",
        kind: "property",
        name: "Acme Kyoto",
        parentId: "CH-1",
        location: "kyoto",
        roomCount: 80,
      });
      expect(p.status).toBe("registered");
      expect((await getProperty(e, { propertyId: "P-1" })).property?.parentId).toBe("ch-1");
    });
    it("is idempotent + rejects bad kind", async () => {
      await registerProperty(e, { propertyId: "CH-1", kind: "chain", name: "Acme" });
      expect((await registerProperty(e, { propertyId: "CH-1", kind: "chain", name: "Acme" })).status).toBe("alreadyExists");
      expect((await registerProperty(e, { propertyId: "X", kind: "resort" as any, name: "X" })).status).toBe("rejected");
    });
    it("lists by parent", async () => {
      await registerProperty(e, { propertyId: "CH-1", kind: "chain", name: "Acme" });
      await registerProperty(e, { propertyId: "P-1", kind: "property", name: "K", parentId: "CH-1" });
      expect((await listProperties(e, { parentId: "CH-1" })).total).toBe(1);
    });
  });

  describe("resource-flow", () => {
    beforeEach(async () => {
      await registerProperty(e, { propertyId: "P-1", kind: "property", name: "Acme Kyoto" });
    });
    it("emits a flow for a rostered property", async () => {
      const r = await emitFlow(e, { propertyId: "P-1", metric: "revenue", period: "2026-07", value: "1200000000" });
      expect(r.status).toBe("emitted");
      const got = await getFlow(e, { propertyId: "P-1", metric: "revenue", period: "2026-07" });
      expect(got.flow?.value).toBe("1200000000");
    });
    it("rejects flow for a non-rostered property", async () => {
      expect((await emitFlow(e, { propertyId: "GHOST", metric: "revenue", period: "2026-07", value: "1" })).status).toBe("propertyNotFound");
    });
    it("rejects invalid metric / period / value", async () => {
      expect((await emitFlow(e, { propertyId: "P-1", metric: "stars" as any, period: "2026-07", value: "1" })).status).toBe("rejected");
      expect((await emitFlow(e, { propertyId: "P-1", metric: "revenue", period: "2026-7", value: "1" })).status).toBe("rejected");
      expect((await emitFlow(e, { propertyId: "P-1", metric: "revenue", period: "2026-07", value: "1.5" })).status).toBe("rejected");
    });
    it("is idempotent per (property, metric, period)", async () => {
      await emitFlow(e, { propertyId: "P-1", metric: "roomNights", period: "2026-07", value: "1500" });
      expect((await emitFlow(e, { propertyId: "P-1", metric: "roomNights", period: "2026-07", value: "1500" })).status).toBe("alreadyExists");
    });
    it("lists + coverage aggregates", async () => {
      await emitFlow(e, { propertyId: "P-1", metric: "revenue", period: "2026-07", value: "1200000000" });
      await emitFlow(e, { propertyId: "P-1", metric: "roomNights", period: "2026-07", value: "1500" });
      expect((await listFlows(e, { metric: "revenue" })).total).toBe(1);
      const cov = await coverage(e);
      expect(cov.propertyCount).toBe(1);
      expect(cov.propertiesByKind?.property).toBe(1);
      expect(cov.flowCount).toBe(2);
      expect(cov.flowsByMetric?.revenue).toBe(1);
    });
  });
});
