import { describe, expect, it } from "vitest";
import { featuredScenarios, misleadingSixStation, reliabilityLine } from "../src/examples/presets";
import { runPairedExperiment } from "../src/experiments/runner";
import { buildReportHtml, buildScenarioCsv } from "../src/export/exporters";
import { currentScenarioResults, scenariosForModel, simulationFingerprint } from "../src/ui/config";
import { deriveEconomics } from "../src/economics/economics";

describe("product-pass state and safe exports", () => {
  it("fingerprints physics but excludes demand and scenario costs", () => {
    const base = simulationFingerprint(misleadingSixStation, featuredScenarios);
    expect(simulationFingerprint({ ...misleadingSixStation, economics: { ...misleadingSixStation.economics, annualDemandUnits: 1 } }, featuredScenarios)).toBe(base);
    const cheaper = featuredScenarios.map((scenario, index) => index === 0 ? { ...scenario, capex: 1 } : scenario);
    expect(simulationFingerprint(misleadingSixStation, cheaper)).toBe(base);
    expect(simulationFingerprint({ ...misleadingSixStation, shiftMinutes: 481 }, featuredScenarios)).not.toBe(base);
    const changedIntervention = featuredScenarios.map((scenario, index) => index === 0 && scenario.intervention.type === "add-machine" ? { ...scenario, intervention: { ...scenario.intervention, count: 2 } } : scenario);
    expect(simulationFingerprint(misleadingSixStation, changedIntervention)).not.toBe(base);
  });

  it("synchronizes current economic fields without changing physical draws", () => {
    const physical = runPairedExperiment(misleadingSixStation, featuredScenarios[0]!, { replications: 3 });
    const current = [{ ...featuredScenarios[0]!, capex: 1, annualOperatingExpense: 0 }];
    const synced = currentScenarioResults([physical], current)[0]!;
    expect(synced.scenario.capex).toBe(1); expect(synced.baselineRuns).toEqual(physical.baselineRuns); expect(synced.modifiedRuns).toEqual(physical.modifiedRuns);
    expect(deriveEconomics(synced, misleadingSixStation.economics).netAnnualBenefit).toBeGreaterThan(deriveEconomics(physical, misleadingSixStation.economics).netAnnualBenefit);
  });

  it("retargets every intervention coherently when a preset changes", () => {
    const next = scenariosForModel(reliabilityLine, featuredScenarios);
    expect(next.every((scenario) => reliabilityLine.stations.some((station) => station.id === scenario.intervention.stationId))).toBe(true);
    const buffer = next.find((scenario) => scenario.intervention.type === "increase-buffer")!;
    expect(buffer.intervention.type === "increase-buffer" && buffer.intervention.capacity).toBeGreaterThan(reliabilityLine.stations[1]!.outputBufferCapacity);
  });

  it("escapes report markup and neutralizes spreadsheet formulas", () => {
    const physical = runPairedExperiment(misleadingSixStation, { ...featuredScenarios[0]!, name: '=HYPERLINK("bad")<script>alert(1)</script>' }, { replications: 3 });
    const economic = deriveEconomics(physical, misleadingSixStation.economics);
    const csv = buildScenarioCsv([physical], [economic]); const report = buildReportHtml({ ...misleadingSixStation, name: "<img src=x onerror=alert(1)>" }, [physical], [economic], "fingerprint");
    expect(csv).toContain("'=HYPERLINK"); expect(report).not.toContain("<script>alert(1)</script>"); expect(report).not.toContain("<img src=x");
    expect(report).toContain("&lt;script&gt;"); expect(report).toContain("fingerprint");
  });
});
