import type { CycleTime, DistributionSummary, FactoryModel, PhysicalScenarioResult, Scenario } from "../contracts/model";
import { factoryModelSchema, scenarioSchema } from "../contracts/model";
import { simulateFactory } from "../simulation/simulator";

function scaleCycle(cycle: CycleTime, factor: number): CycleTime {
  if (cycle.kind === "fixed") return { ...cycle, minutes: cycle.minutes * factor };
  if (cycle.kind === "triangular") return { ...cycle, min: cycle.min * factor, mode: cycle.mode * factor, max: cycle.max * factor };
  return { ...cycle, meanMinutes: cycle.meanMinutes * factor };
}

export function applyIntervention(modelInput: FactoryModel, scenarioInput: Scenario): FactoryModel {
  const model = factoryModelSchema.parse(structuredClone(modelInput)); const scenario = scenarioSchema.parse(scenarioInput);
  const index = model.stations.findIndex((station) => station.id === scenario.intervention.stationId);
  if (index < 0) throw new Error(`Unknown target station: ${scenario.intervention.stationId}`);
  const station = model.stations[index]!; const intervention = scenario.intervention;
  if (intervention.type === "add-machine") station.machines += intervention.count;
  else if (intervention.type === "reduce-cycle-time") station.cycleTime = scaleCycle(station.cycleTime, 1 - intervention.percent / 100);
  else if (intervention.type === "increase-buffer") {
    if (index === model.stations.length - 1) throw new Error("The final station has no output buffer");
    if (intervention.capacity <= station.outputBufferCapacity) throw new Error("New buffer capacity must exceed the current capacity");
    station.outputBufferCapacity = intervention.capacity;
  } else {
    station.mtbfMinutes *= intervention.mtbfMultiplier;
    station.mttrMinutes *= 1 - intervention.mttrReductionPercent / 100;
  }
  return factoryModelSchema.parse(model);
}

export function replicationSeeds(baseSeed: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => ((baseSeed + Math.imul(index + 1, 104_729)) % 2_147_483_646) + 1);
}

export function summarize(values: number[]): DistributionSummary {
  if (values.length < 2) throw new Error("At least two observations are required");
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  const standardDeviation = Math.sqrt(variance); const halfWidth = tCritical95(values.length - 1) * standardDeviation / Math.sqrt(values.length);
  return { mean, standardDeviation, min: Math.min(...values), max: Math.max(...values), ci95: [mean - halfWidth, mean + halfWidth] };
}

const smallSampleTCritical = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
function tCritical95(degreesOfFreedom: number): number {
  if (degreesOfFreedom <= 30) return smallSampleTCritical[degreesOfFreedom]!;
  const z = 1.959963984540054; const n = degreesOfFreedom;
  return z + (z ** 3 + z) / (4 * n) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * n ** 2) + (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) / (384 * n ** 3);
}

export interface RunOptions { replications?: number; onProgress?: (completed: number, total: number) => void; isCancelled?: () => boolean }

export function runPairedExperiment(modelInput: FactoryModel, scenarioInput: Scenario, options: RunOptions = {}): PhysicalScenarioResult {
  const model = factoryModelSchema.parse(modelInput); const scenario = scenarioSchema.parse(scenarioInput);
  const modifiedModel = applyIntervention(model, scenario); const count = options.replications ?? model.defaultReplications;
  if (!Number.isInteger(count) || count < 2 || count > 2_000) throw new Error("Replications must be an integer from 2 to 2000");
  const seeds = replicationSeeds(model.baseSeed, count); const baselineRuns = []; const modifiedRuns = [];
  for (let i = 0; i < seeds.length; i += 1) {
    if (options.isCancelled?.()) throw new Error("Experiment cancelled");
    baselineRuns.push(simulateFactory(model, seeds[i]!)); modifiedRuns.push(simulateFactory(modifiedModel, seeds[i]!));
    options.onProgress?.(i + 1, seeds.length);
  }
  const baselineValues = baselineRuns.map((r) => r.completedUnits); const modifiedValues = modifiedRuns.map((r) => r.completedUnits);
  const deltas = modifiedValues.map((value, i) => value - baselineValues[i]!);
  const baseline = summarize(baselineValues); const modified = summarize(modifiedValues); const pairedDelta = summarize(deltas);
  return { scenario, baseline, modified, pairedDelta, percentGain: baseline.mean ? pairedDelta.mean / baseline.mean * 100 : null, replicationSeeds: seeds, baselineRuns, modifiedRuns, intervalMethod: "paired t 95% CI for mean effect" };
}
