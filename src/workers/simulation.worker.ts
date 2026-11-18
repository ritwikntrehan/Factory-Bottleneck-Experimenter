/// <reference lib="webworker" />
import type { FactoryModel, PhysicalScenarioResult, Scenario } from "../contracts/model";
import { runPairedExperiment } from "../experiments/runner";

type Request = { type: "run"; model: FactoryModel; scenarios: Scenario[]; replications: number };

self.onmessage = (message: MessageEvent<Request>) => {
  if (message.data.type !== "run") return;
  const { model, scenarios, replications } = message.data;
  try {
    const results: PhysicalScenarioResult[] = [];
    scenarios.forEach((scenario, scenarioIndex) => {
      results.push(runPairedExperiment(model, scenario, { replications, onProgress: (completed, total) => self.postMessage({ type: "progress", completed: scenarioIndex * total + completed, total: scenarios.length * total }) }));
    });
    self.postMessage({ type: "complete", results });
  } catch (error) { self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) }); }
};

export {};
