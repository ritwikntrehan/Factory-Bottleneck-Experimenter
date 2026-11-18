import { describe, expect, it } from "vitest";
import type { FactoryModel } from "../src/contracts/model";
import { simulateFactory } from "../src/simulation/simulator";

const model = (cycles = [1, 2, 1], shiftMinutes = 1_000): FactoryModel => ({
  schemaVersion: "1.0", name: "Test line", description: "Synthetic test fixture", synthetic: true,
  shiftMinutes, supplyCap: 5_000, interarrivalMinutes: 0, defaultReplications: 10, baseSeed: 123,
  economics: { shiftsPerDay: 1, operatingDaysPerYear: 250, annualDemandUnits: 1_000_000, contributionMarginPerUnit: 10 },
  stations: cycles.map((minutes, i) => ({ id: `s${i}`, name: `Station ${i}`, machines: 1, cycleTime: { kind: "fixed", minutes }, mtbfMinutes: 1_000_000, mttrMinutes: 1, source: "estimated", outputBufferCapacity: 20 })),
});

describe("discrete-event production line", () => {
  it("converges toward the slowest deterministic station rate", () => {
    const result = simulateFactory(model(), 10);
    expect(result.completedUnits).toBeGreaterThanOrEqual(495); expect(result.completedUnits).toBeLessThanOrEqual(500);
  });
  it("conserves parts, routes every completion, and respects capacities", () => {
    const m = model([1, 4, 1], 100); m.stations[0]!.outputBufferCapacity = 1; m.stations[1]!.outputBufferCapacity = 1;
    const result = simulateFactory(m, 42);
    expect(result.conservation.balanced).toBe(true); expect(result.completedPartRoutes.every((visits) => visits === 3)).toBe(true);
    result.bufferMetrics.forEach((buffer) => expect(buffer.maxOccupancy).toBeLessThanOrEqual(buffer.capacity));
  });
  it("unblocks a full buffer and continues producing", () => {
    const m = model([1, 10, 1], 120); m.stations[0]!.outputBufferCapacity = 1;
    const result = simulateFactory(m, 7); expect(result.completedUnits).toBeGreaterThan(8); expect(result.stationMetrics[0]!.blocked).toBeGreaterThan(0);
  });
  it("counts only final completions before a mid-operation cutoff", () => {
    const result = simulateFactory(model([10, 10, 10], 15), 3);
    expect(result.completedUnits).toBe(0); expect(result.systemWipAtCutoff).toBeGreaterThan(0); expect(result.conservation.balanced).toBe(true);
  });
  it("handles empty supply", () => {
    const m = model(); m.supplyCap = 0; const result = simulateFactory(m, 1);
    expect(result.completedUnits).toBe(0); expect(result.meanWip).toBe(0); expect(result.stationMetrics.every((s) => s.starved === 1)).toBe(true);
  });
  it("parallel machines materially raise capacity", () => {
    const single = model([1, 5, 1], 200); const parallel = structuredClone(single); parallel.stations[1]!.machines = 2;
    expect(simulateFactory(parallel, 33).completedUnits).toBeGreaterThan(simulateFactory(single, 33).completedUnits * 1.8);
  });
  it("higher failure frequency increases downtime and reduces average output", () => {
    const reliable = model([2, 2, 2], 480); const failing = structuredClone(reliable); failing.stations[1]!.mtbfMinutes = 35; failing.stations[1]!.mttrMinutes = 12;
    const seeds = Array.from({ length: 30 }, (_, i) => i + 100);
    const a = seeds.map((s) => simulateFactory(reliable, s)); const b = seeds.map((s) => simulateFactory(failing, s));
    expect(b.reduce((sum, r) => sum + r.stationMetrics[1]!.down, 0)).toBeGreaterThan(a.reduce((sum, r) => sum + r.stationMetrics[1]!.down, 0));
    expect(b.reduce((sum, r) => sum + r.completedUnits, 0)).toBeLessThan(a.reduce((sum, r) => sum + r.completedUnits, 0));
  });
  it("machine state times conserve the shift denominator", () => {
    const m = model([2, 2, 2], 480); m.stations[1]!.mtbfMinutes = 30; m.stations[1]!.mttrMinutes = 15;
    for (const station of simulateFactory(m, 44).stationMetrics) expect(station.processing + station.blocked + station.starved + station.down).toBeCloseTo(1, 10);
  });
  it("is exactly reproducible for the same seed", () => expect(simulateFactory(model(), 999)).toEqual(simulateFactory(model(), 999)));
  it("validates malformed and pathologically large inputs", () => {
    const invalid = model(); invalid.stations = invalid.stations.slice(0, 2); expect(() => simulateFactory(invalid, 1)).toThrow();
    const tooLarge = model(); tooLarge.supplyCap = 100_001; expect(() => simulateFactory(tooLarge, 1)).toThrow();
  });
});
