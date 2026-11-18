import { describe, expect, it } from "vitest";
import type { FactoryModel, Scenario } from "../src/contracts/model";
import { misleadingSixStation, featuredScenarios } from "../src/examples/presets";
import { applyIntervention, runPairedExperiment, summarize } from "../src/experiments/runner";

describe("paired experiments", () => {
  it("calculates known mean, sample deviation, and mean-effect interval", () => {
    const result = summarize([1, 2, 3, 4]); expect(result.mean).toBe(2.5); expect(result.standardDeviation).toBeCloseTo(1.290994449);
    expect(result.ci95[0]).toBeCloseTo(0.4457, 3); expect(result.ci95[1]).toBeCloseTo(4.5543, 3);
  });
  it("keeps matched seeds and is exactly repeatable", () => {
    const a = runPairedExperiment(misleadingSixStation, featuredScenarios[0]!, { replications: 8 });
    const b = runPairedExperiment(misleadingSixStation, featuredScenarios[0]!, { replications: 8 });
    expect(a).toEqual(b); expect(a.baselineRuns.map((r) => r.seed)).toEqual(a.modifiedRuns.map((r) => r.seed));
  });
  it("speeding a nonconstraint can leave throughput unchanged", () => {
    const model = structuredClone(misleadingSixStation); model.stations.forEach((s) => { s.mtbfMinutes = 1_000_000; s.mttrMinutes = 1; });
    model.stations[5]!.cycleTime = { kind: "fixed", minutes: 2 };
    const scenario: Scenario = { id: "speed-pack", name: "Speed pack", intervention: { type: "reduce-cycle-time", stationId: "pack", percent: 50 }, capex: 10, usefulLifeYears: 5, annualOperatingExpense: 0 };
    expect(runPairedExperiment(model, scenario, { replications: 5 }).pairedDelta.mean).toBe(0);
  });
  it("rejects a buffer intervention on finished goods", () => {
    const scenario: Scenario = { id: "bad", name: "Bad", intervention: { type: "increase-buffer", stationId: "pack", capacity: 10 }, capex: 0, usefulLifeYears: 1, annualOperatingExpense: 0 };
    expect(() => applyIntervention(misleadingSixStation, scenario)).toThrow(/final station/);
  });
  it("preserves the featured counterfactual ordering", () => {
    const extraMachine = runPairedExperiment(misleadingSixStation, featuredScenarios[0]!, { replications: 100 });
    const reliability = runPairedExperiment(misleadingSixStation, featuredScenarios[2]!, { replications: 100 });
    const form = extraMachine.baselineRuns.flatMap((r) => r.stationMetrics).filter((s) => s.stationId === "form").reduce((sum, s) => sum + s.processing, 0) / 100;
    expect(form).toBeGreaterThan(0.85); expect(extraMachine.pairedDelta.mean).toBeLessThan(3); expect(reliability.pairedDelta.mean).toBeGreaterThan(8); expect(reliability.pairedDelta.mean).toBeGreaterThan(extraMachine.pairedDelta.mean * 3);
  });
});
