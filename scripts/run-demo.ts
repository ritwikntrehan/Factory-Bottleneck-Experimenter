import { deriveEconomics } from "../src/economics/economics";
import { featuredScenarios, misleadingSixStation } from "../src/examples/presets";
import { runPairedExperiment } from "../src/experiments/runner";

console.log(`Synthetic demo: ${misleadingSixStation.name}`);
for (const scenario of featuredScenarios) {
  const result = runPairedExperiment(misleadingSixStation, scenario, { replications: misleadingSixStation.defaultReplications });
  const economics = deriveEconomics(result, misleadingSixStation.economics);
  console.log(JSON.stringify({ scenario: scenario.name, baseline: result.baseline.mean, modified: result.modified.mean, delta: result.pairedDelta.mean, ci95: result.pairedDelta.ci95, percentGain: result.percentGain, netAnnualBenefit: economics.netAnnualBenefit }));
}
