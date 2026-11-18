import { describe, expect, it } from "vitest";
import { deriveEconomics } from "../src/economics/economics";
import { featuredScenarios, misleadingSixStation } from "../src/examples/presets";
import { runPairedExperiment } from "../src/experiments/runner";

describe("demand-aware economics", () => {
  it("caps added saleable output at demand and never monetizes unsold units", () => {
    const physics = runPairedExperiment(misleadingSixStation, featuredScenarios[2]!, { replications: 5 });
    const lowDemand = deriveEconomics(physics, { ...misleadingSixStation.economics, annualDemandUnits: 1 });
    expect(lowDemand.incrementalSaleableUnits).toBe(0); expect(lowDemand.costPerAddedSaleableUnit).toBeNull(); expect(lowDemand.simplePaybackYears).toBeNull();
  });
  it("economic edits do not mutate or rerun physical results", () => {
    const physics = runPairedExperiment(misleadingSixStation, featuredScenarios[2]!, { replications: 5 }); const snapshot = structuredClone(physics);
    const low = deriveEconomics(physics, { ...misleadingSixStation.economics, contributionMarginPerUnit: 1 });
    const high = deriveEconomics(physics, { ...misleadingSixStation.economics, contributionMarginPerUnit: 100 });
    expect(high.netAnnualBenefit).toBeGreaterThan(low.netAnnualBenefit); expect(physics).toEqual(snapshot);
  });
  it("uses demand-limited units in cost per added unit", () => {
    const physics = runPairedExperiment(misleadingSixStation, featuredScenarios[2]!, { replications: 5 }); const baselineAnnual = physics.baseline.mean * 500;
    const result = deriveEconomics(physics, { ...misleadingSixStation.economics, annualDemandUnits: baselineAnnual + 100 });
    expect(result.incrementalSaleableUnits).toBeCloseTo(100); expect(result.costPerAddedSaleableUnit).toBeCloseTo((result.annualizedCapex + physics.scenario.annualOperatingExpense) / 100);
  });
});
