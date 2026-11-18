import type { FactoryModel, PhysicalScenarioResult, Scenario } from "../contracts/model";

export type ModelProvenance = "synthetic-preset" | "modified-synthetic" | "user-supplied";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stable(entry)]));
  return value;
}

export function simulationFingerprint(model: FactoryModel, scenarios: Scenario[]): string {
  const { economics: _economics, ...physicalModel } = model;
  const physicalScenarios = scenarios.map(({ id, intervention }) => ({ id, intervention }));
  return JSON.stringify(stable({ physicalModel, physicalScenarios }));
}

export function currentScenarioResults(results: PhysicalScenarioResult[], scenarios: Scenario[]): PhysicalScenarioResult[] {
  return results.map((result) => {
    const current = scenarios.find((scenario) => scenario.id === result.scenario.id);
    return current ? { ...result, scenario: current } : result;
  });
}

export function scenariosForModel(model: FactoryModel, templates: Scenario[]): Scenario[] {
  return templates.map((scenario) => {
    const intervention = scenario.intervention;
    if (intervention.type === "add-machine") return { ...scenario, intervention: { ...intervention, stationId: model.stations[1]!.id } };
    if (intervention.type === "increase-buffer") return { ...scenario, intervention: { ...intervention, stationId: model.stations[1]!.id, capacity: model.stations[1]!.outputBufferCapacity + 5 } };
    if (intervention.type === "improve-reliability") return { ...scenario, intervention: { ...intervention, stationId: model.stations[Math.min(2, model.stations.length - 1)]!.id } };
    return { ...scenario, intervention: { ...intervention, stationId: model.stations.at(-1)!.id } };
  });
}
