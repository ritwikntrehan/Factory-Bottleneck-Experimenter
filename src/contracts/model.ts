import { z } from "zod";

const positive = z.number().finite().positive();

export const cycleTimeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), minutes: positive.max(1_440) }),
  z.object({
    kind: z.literal("triangular"),
    min: positive.max(1_440),
    mode: positive.max(1_440),
    max: positive.max(1_440),
  }).refine((v) => v.min <= v.mode && v.mode <= v.max, "Expected min ≤ mode ≤ max"),
  z.object({ kind: z.literal("lognormal"), meanMinutes: positive.max(1_440), cv: positive.max(5) }),
]);

export const stationSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(40),
  name: z.string().trim().min(1).max(80),
  machines: z.number().int().min(1).max(20),
  cycleTime: cycleTimeSchema,
  mtbfMinutes: positive.max(1_000_000),
  mttrMinutes: positive.max(10_000),
  source: z.enum(["measured", "estimated"]),
  outputBufferCapacity: z.number().int().min(1).max(10_000),
});

export const economicsSchema = z.object({
  shiftsPerDay: positive.max(8),
  operatingDaysPerYear: z.number().int().min(1).max(366),
  annualDemandUnits: z.number().finite().nonnegative().max(1_000_000_000),
  contributionMarginPerUnit: z.number().finite().nonnegative().max(1_000_000),
  discountRate: z.number().finite().min(0).max(1).optional(),
});

export const factoryModelSchema = z.object({
  schemaVersion: z.literal("1.0"),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2_000),
  synthetic: z.boolean(),
  shiftMinutes: positive.max(10_080),
  supplyCap: z.number().int().min(0).max(100_000),
  interarrivalMinutes: z.number().finite().nonnegative().max(10_080),
  defaultReplications: z.number().int().min(2).max(2_000),
  baseSeed: z.number().int().min(1).max(2_147_483_647),
  stations: z.array(stationSchema).min(3).max(10),
  economics: economicsSchema,
}).superRefine((model, ctx) => {
  const ids = new Set<string>();
  model.stations.forEach((station, index) => {
    if (ids.has(station.id)) ctx.addIssue({ code: "custom", path: ["stations", index, "id"], message: "Station IDs must be unique" });
    ids.add(station.id);
  });
});

export type CycleTime = z.infer<typeof cycleTimeSchema>;
export type Station = z.infer<typeof stationSchema>;
export type EconomicsInputs = z.infer<typeof economicsSchema>;
export type FactoryModel = z.infer<typeof factoryModelSchema>;

export const scenarioSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  intervention: z.discriminatedUnion("type", [
    z.object({ type: z.literal("add-machine"), stationId: z.string(), count: z.number().int().min(1).max(10) }),
    z.object({ type: z.literal("reduce-cycle-time"), stationId: z.string(), percent: z.number().finite().min(1).max(90) }),
    z.object({ type: z.literal("increase-buffer"), stationId: z.string(), capacity: z.number().int().min(1).max(10_000) }),
    z.object({ type: z.literal("improve-reliability"), stationId: z.string(), mtbfMultiplier: z.number().finite().min(1.01).max(100), mttrReductionPercent: z.number().finite().min(0).max(95) }),
  ]),
  capex: z.number().finite().nonnegative().max(1_000_000_000),
  usefulLifeYears: positive.max(100),
  annualOperatingExpense: z.number().finite().min(-1_000_000_000).max(1_000_000_000),
});

export type Scenario = z.infer<typeof scenarioSchema>;
export type MachineState = "processing" | "blocked" | "starved" | "down";

export interface StateFractions { processing: number; blocked: number; starved: number; down: number }
export interface BufferMetric { stationId: string; capacity: number; meanOccupancy: number; maxOccupancy: number }
export interface StationMetric extends StateFractions { stationId: string; stationName: string; machineMinutes: number }

export interface SimulationResult {
  simulatorVersion: string;
  seed: number;
  shiftMinutes: number;
  completedUnits: number;
  arrivedSupply: number;
  unusedSupplyQueue: number;
  systemWipAtCutoff: number;
  meanWip: number;
  peakWip: number;
  meanFlowTimeMinutes: number | null;
  stationMetrics: StationMetric[];
  bufferMetrics: BufferMetric[];
  completedPartRoutes: number[];
  conservation: { arrivals: number; completed: number; systemWip: number; unusedSupplyQueue: number; balanced: boolean };
}

export interface DistributionSummary { mean: number; standardDeviation: number; min: number; max: number; ci95: [number, number] }
export interface PhysicalScenarioResult {
  scenario: Scenario;
  baseline: DistributionSummary;
  modified: DistributionSummary;
  pairedDelta: DistributionSummary;
  percentGain: number | null;
  replicationSeeds: number[];
  baselineRuns: SimulationResult[];
  modifiedRuns: SimulationResult[];
  intervalMethod: "paired t 95% CI for mean effect";
}

export interface ScenarioEconomics {
  annualBaselinePhysicalUnits: number;
  annualScenarioPhysicalUnits: number;
  annualBaselineSaleableUnits: number;
  annualScenarioSaleableUnits: number;
  incrementalSaleableUnits: number;
  grossIncrementalContribution: number;
  annualizedCapex: number;
  netAnnualBenefit: number;
  costPerAddedSaleableUnit: number | null;
  simplePaybackYears: number | null;
  uncertaintyWarning: boolean;
  annualizationMethod: "straight-line" | "capital-recovery-factor";
}

export function parseFactoryModel(input: unknown): FactoryModel { return factoryModelSchema.parse(input); }
